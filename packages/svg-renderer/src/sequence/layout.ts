import type {
  SequenceDiagram,
  PositionedSequenceDiagram,
  PositionedActor,
  Lifeline,
  PositionedMessage,
  Activation,
  PositionedBlock,
  PositionedNote,
  PositionedParticipantBox,
} from '@zombie-mermaid/mermaid-parser'
import type {
  RenderOptions,
  SequenceInitLayout,
  SequenceRenderOptions,
} from '@zombie-mermaid/core'
import { LINE_HEIGHT_RATIO, measureMultilineText } from '@zombie-mermaid/core'
import { estimateTextWidth, FONT_WEIGHTS, resolveFontSizes } from '../styles.ts'

// ============================================================================
// Sequence diagram layout engine
//
// Custom timeline-based layout (no ELK — sequence diagrams aren't graphs).
//
// Layout strategy:
//   1. Space actors horizontally based on label widths + min gap
//   2. Stack messages vertically in chronological order
//   3. Track activation boxes via a stack
//   4. Position blocks (loop/alt/opt) as background rectangles
//   5. Position notes next to their target actors
// ============================================================================

/** Layout constants specific to sequence diagrams */
const SEQ = {
  /** Padding around the entire diagram */
  padding: 30,
  /** Padding above and below the diagram (`padding` is the horizontal one). */
  paddingY: 30,
  /** Extra room under the bottom row (`bottomMarginAdj`). */
  bottomAdj: 0,
  /** Narrowest an actor box gets. */
  actorMinWidth: 80,
  /** Minimum gap between actor centers */
  actorGap: 140,
  /** Actor box height */
  actorHeight: 40,
  /** Horizontal padding inside actor boxes */
  actorPadX: 16,
  /** Vertical space between actor boxes and first message */
  headerGap: 20,
  /** Vertical space per message row */
  messageRowHeight: 40,
  /** Extra vertical space for self-messages (they loop back) */
  selfMessageHeight: 30,
  /** Activation box width (narrow rectangle on lifeline) */
  activationWidth: 10,
  /** Block padding (loop/alt borders) */
  blockPadX: 10,
  blockPadTop: 40,
  blockPadBottom: 8,
  /** Extra vertical space before the first message in a block (room for the header label) */
  blockHeaderExtra: 28,
  /**
   * Extra room between a block's header label and the first message below it,
   * so the label sits 33px above that message's label as in mermaid 12.3.0
   * (measured at 16px text, in absolute px; ours was 7px).
   */
  blockHeaderLabelGap: 26,
  /**
   * The same room for a block with another block opening inside it at the same
   * message: the outer header sits 45px (label top to label top) above the
   * inner one in mermaid 12.3.0, ours was 28px.
   */
  blockNestedHeaderGap: 17,
  /** Extra vertical space before a message at a divider boundary (room for else/and label) */
  dividerExtra: 24,
  /**
   * Extra room between a divider and the message below it, so the divider
   * label sits 28px above that message's label as in mermaid 12.3.0 (measured
   * at 16px text, in absolute px; ours was 2px).
   */
  dividerLabelGap: 26,
  /** Note dimensions */
  noteWidth: 60,
  notePadX: 12,
  notePadY: 6,
  noteGap: 10,
  /** Gap between a message arrow and a note positioned directly after it */
  noteOffsetAfterMessage: 8,
  /** Gap between consecutively stacked notes */
  noteStackGap: 4,
  /**
   * `box … end` group padding: horizontal clearance beyond the outermost
   * member's box, vertical clearance above the actor boxes (under the label
   * band) and below the lifeline bottoms.
   */
  boxPad: 10,
  /** Room reserved above everything for a `title` line */
  titleBand: 36,
} as const

/** Font size of the `title` line, shared with the renderer. */
export const TITLE_FONT_SIZE = 18

/**
 * Mermaid's self-message loop (`M x,y C x+60,y-10 x+60,y+30 x,y+20`): the
 * control points sit 60px out, so the curve itself reaches 3/4 of that.
 * Shared with the renderer, and with the bounding box and gap fitting here.
 */
export const SELF_LOOP_CONTROL = 60
export const SELF_LOOP_EXTENT = SELF_LOOP_CONTROL * 0.75
export const SELF_LOOP_HEIGHT = 20

/**
 * Height of the label band at the top of a `box … end` group, in px — the
 * label's font size plus vertical breathing room. Shared with the renderer
 * so the label lands centred in the band the layout reserved for it.
 */
export function boxLabelHeight(labelFontSize: number): number {
  return labelFontSize + 8
}

/**
 * Distance from the bottom of a stick-figure (`actor`) icon to the vertical
 * centre of its label. Shared with the renderer so the label lands where the
 * layout reserved room for it.
 */
export const ACTOR_LABEL_OFFSET = 14

/**
 * `participant X@{ "type": ... }` kinds drawn as a free-standing icon with the
 * label beneath it, like a stick-figure `actor`. `collections` and `queue`
 * keep the label inside a box-shaped glyph, so they are not listed here.
 */
const ICON_PARTICIPANT_TYPES: ReadonlySet<string | undefined> = new Set([
  'boundary',
  'control',
  'entity',
  'database',
])

/** True when the label sits below the icon (stick-figure or typed icon). */
export function hasLabelBelowIcon(a: {
  type: 'participant' | 'actor'
  participantType?: string | undefined
}): boolean {
  return a.type === 'actor' || ICON_PARTICIPANT_TYPES.has(a.participantType)
}

/** Clearance kept between an actor label and what sits below it, in px. */
const ACTOR_LABEL_CLEARANCE = 4

/**
 * Distance from the bottom of a stick-figure icon to the bottom of its
 * (possibly multi-line) label. Only `actor` participants draw a label below
 * the icon; a `participant` box holds its label inside.
 */
function actorLabelBottom(
  label: string,
  fontSize: number,
  fontWeight: number,
): number {
  return (
    ACTOR_LABEL_OFFSET +
    measureMultilineText(label, fontSize, fontWeight).height / 2
  )
}

/** Resolved sequence-layout config — same shape as {@link SEQ} but mutable numbers. */
type SeqConfig = { [K in keyof typeof SEQ]: number }

/**
 * Merge user-provided sequence-layout overrides over the {@link SEQ} defaults.
 * Any field left unspecified (or `undefined`) falls back to its default.
 */
function resolveSeqOptions(
  overrides?: RenderOptions['sequence'],
  init?: SequenceInitLayout,
): SeqConfig {
  // `%%{init}%%` keys are mermaid px at 16px text. This renderer lays out at
  // its own scale, so each key moves our constant by its distance from
  // mermaid's default (absent or default = unchanged). Explicit render
  // options win over the directive.
  const d = (v: number | undefined, def: number) => (v ?? def) - def
  const dn = d(init?.noteMargin, 10)
  const dpx = d(init?.diagramMarginX, 50)
  return {
    ...SEQ,
    padding: SEQ.padding + dpx,
    paddingY: SEQ.paddingY + d(init?.diagramMarginY, 10),
    bottomAdj: Math.max(0, d(init?.bottomMarginAdj, 1)),
    actorMinWidth: SEQ.actorMinWidth + d(init?.width, 150),
    actorGap: SEQ.actorGap + d(init?.actorMargin, 50),
    activationWidth: SEQ.activationWidth + d(init?.activationWidth, 10),
    selfMessageHeight: SEQ.selfMessageHeight - (init?.rightAngles ? 10 : 0),
    notePadX: SEQ.notePadX + dn,
    notePadY: SEQ.notePadY + dn,
    actorHeight:
      overrides?.actorHeight ?? SEQ.actorHeight + d(init?.height, 65),
    headerGap: overrides?.headerGap ?? SEQ.headerGap,
    messageRowHeight:
      overrides?.messageRowHeight ??
      SEQ.messageRowHeight + d(init?.boxMargin, 10),
    noteOffsetAfterMessage:
      overrides?.noteOffsetAfterMessage ?? SEQ.noteOffsetAfterMessage,
    noteStackGap: overrides?.noteStackGap ?? SEQ.noteStackGap,
  }
}

/** Space kept between a message label and the next lifeline. */
const LABEL_CLEARANCE = 16

/** Width of the widest line of a (possibly multi-line) label. */
function labelWidth(
  text: string,
  fontSize: number,
  weight: number = FONT_WEIGHTS.edgeLabel,
): number {
  return measureMultilineText(text, fontSize, weight).width
}

/**
 * Stroke width of a lifeline. Mermaid 12.3.0 draws `.actor-line` solid at
 * `stroke-width="0.5px"`, in absolute px like the block frame below.
 */
export const LIFELINE_STROKE = 0.5

/**
 * Stroke width of a block's frame and divider lines. Mermaid 12.3.0 draws
 * `.loopLine` 2px wide (the tab's `.labelBox` outline is 1px), in absolute
 * px: its geometry is not scaled to the fork's smaller font, so neither are
 * these.
 */
export const BLOCK_LINE_STROKE = 2

/**
 * How far a block's frame extends past its outermost lifelines: mermaid 12.3.0
 * draws it 11px out (`boxMargin` 10 plus half the frame's stroke width).
 */
export function blockFramePad(
  seq: Pick<ReturnType<typeof resolveSeqOptions>, 'blockPadX'>,
): number {
  return seq.blockPadX + BLOCK_LINE_STROKE / 2
}

/** Height of a block's type-label tab, in px. */
export const BLOCK_TAB_HEIGHT = 18

/**
 * The tab's cut bottom-right corner, as fractions of the tab height. Mermaid
 * 12.3.0 draws a 35px tab as `114,111 105.6,118`: a 7px rise and an 8.4px
 * run, i.e. 0.2 and 0.24 of the height.
 */
export const BLOCK_TAB_CUT_RISE_RATIO = 0.2
export const BLOCK_TAB_CUT_RUN_RATIO = 0.24

/** The tab polygon's vertices, clockwise from the block's top-left corner. */
export function blockTabPoints(
  x: number,
  y: number,
  tabWidth: number,
): [number, number][] {
  const cutRun = BLOCK_TAB_HEIGHT * BLOCK_TAB_CUT_RUN_RATIO
  const cutRise = BLOCK_TAB_HEIGHT * BLOCK_TAB_CUT_RISE_RATIO
  return [
    [x, y],
    [x + tabWidth, y],
    [x + tabWidth, y + BLOCK_TAB_HEIGHT - cutRise],
    [x + tabWidth - cutRun, y + BLOCK_TAB_HEIGHT],
    [x, y + BLOCK_TAB_HEIGHT],
  ]
}

/**
 * Width of a block's header tab, as the renderer draws it. A `rect <color>`
 * highlight has no tab.
 */
export function blockTabWidth(
  block: Pick<SequenceDiagram['blocks'][number], 'type' | 'color'>,
  fontSize: number,
): number {
  if (block.type === 'rect' && block.color !== undefined) return 0
  return labelWidth(block.type, fontSize, FONT_WEIGHTS.groupHeader) + 16
}

/**
 * Wrap a block header or divider label (shown as `[label]`) onto lines of at
 * most `avail` px, breaking at spaces. Mermaid wraps these to the frame
 * instead of widening the participant gap (#2745). A word wider than `avail`
 * stays whole (mermaid would split it mid-word).
 */
function wrapBracketed(label: string, avail: number, fontSize: number): string {
  const text = `[${label}]`
  const out: string[] = []
  for (const line of text.split('\n')) {
    let cur = ''
    for (const word of line.split(' ')) {
      // mermaid's wrapLabel: break once the line so far plus the next word
      // (with its trailing space) reaches the limit.
      if (
        cur &&
        labelWidth(cur, fontSize) + labelWidth(`${word} `, fontSize) >= avail
      ) {
        out.push(cur)
        cur = word
      } else cur = cur ? `${cur} ${word}` : word
    }
    out.push(cur)
  }
  return out.join('\n').slice(1, -1)
}

/** Extra height a multi-line label takes over a single line. */
export function dividerLabelExtra(
  label: string | undefined,
  fontSize: number,
): number {
  return label
    ? (label.split('\n').length - 1) * fontSize * LINE_HEIGHT_RATIO
    : 0
}

/**
 * For each block, the indices of the blocks nested inside it. The parser emits
 * a block when it closes, so nested blocks always come before their parent.
 */
function nestedBlocks(blocks: SequenceDiagram['blocks']): number[][] {
  return blocks.map((outer, bi) =>
    blocks
      .slice(0, bi)
      .flatMap((b, j) =>
        b.startIndex >= outer.startIndex && b.endIndex <= outer.endIndex
          ? [j]
          : [],
      ),
  )
}

/**
 * Widen `gaps` (`gaps[i]` = distance from actor i - 1 to actor i) in place so
 * no label crosses a lifeline: a message label between two actors is centred
 * on the span, a self-message label on its lifeline, a note sits beside or
 * over its actor. A shortfall on a span of several gaps is spread evenly over them
 * (ported from lukilabs/beautiful-mermaid#167).
 */
function fitLabelsBetweenLifelines(
  diagram: SequenceDiagram,
  actorWidths: number[],
  gaps: number[],
  seq: ReturnType<typeof resolveSeqOptions>,
  fontSize: number,
): void {
  const index = new Map(diagram.actors.map((a, i) => [a.id, i]))
  // Spread any shortfall evenly over the gaps between actors `lo` and `hi`.
  const widen = (lo: number, hi: number, need: number) => {
    if (lo < 0 || hi >= gaps.length) return
    let have = 0
    for (let g = lo + 1; g <= hi; g++) have += gaps[g]!
    if (have >= need) return
    const add = (need - have) / (hi - lo)
    for (let g = lo + 1; g <= hi; g++) gaps[g]! += add
  }

  for (const m of diagram.messages) {
    if (!m.label) continue
    const from = index.get(m.from)!
    const to = index.get(m.to)!
    const w = labelWidth(m.label, fontSize)
    if (from === to) {
      // A self-message label spills w / 2 to each side of its lifeline, so it
      // widens the gap on either side (an end actor has no neighbour to push).
      widen(from - 1, from, w / 2 + LABEL_CLEARANCE)
      widen(from, from + 1, w / 2 + LABEL_CLEARANCE)
    } else {
      widen(Math.min(from, to), Math.max(from, to), w + 2 * LABEL_CLEARANCE)
    }
  }

  for (const n of diagram.notes) {
    const i = index.get(n.actorIds[0] ?? '')!
    const w = Math.max(
      seq.noteWidth,
      labelWidth(n.text, fontSize) + seq.notePadX * 2,
    )
    const reach = actorWidths[i]! / 2 + seq.noteGap + w + LABEL_CLEARANCE
    if (n.position === 'right') widen(i, i + 1, reach)
    else if (n.position === 'left') widen(i - 1, i, reach)
    else if (n.actorIds.length === 1) {
      widen(i, i + 1, w / 2 + LABEL_CLEARANCE)
      widen(i - 1, i, w / 2 + LABEL_CLEARANCE)
    } else {
      // Mermaid spreads the actors so a long note fits its 25px-overhang span.
      const j = index.get(n.actorIds[n.actorIds.length - 1]!)!
      widen(Math.min(i, j), Math.max(i, j), w - 50)
    }
  }
}

/**
 * Lay out a parsed sequence diagram.
 * Returns a fully positioned diagram ready for SVG rendering.
 */
/** Greedy word wrap of each line of `text` to `maxWidth` px (a long word stays whole). */
function wrapLabel(text: string, maxWidth: number, fontSize: number): string {
  const fit = (s: string) =>
    estimateTextWidth(s, fontSize, FONT_WEIGHTS.edgeLabel) <= maxWidth
  return text
    .split('\n')
    .map((line) => {
      const out: string[] = []
      let cur = ''
      for (const word of line.split(/\s+/).filter(Boolean)) {
        if (cur && !fit(`${cur} ${word}`)) {
          out.push(cur)
          cur = word
        } else cur = cur ? `${cur} ${word}` : word
      }
      out.push(cur)
      return out.join('\n')
    })
    .join('\n')
}

/**
 * `sequence.wrap: true`: mermaid wraps notes at `width` (150px at 16px text)
 * and messages at the lifeline gap (`width + actorMargin`). Our text is
 * smaller, so the widths shrink by the font ratio and the same words land on
 * each line.
 */
function wrapDiagramText(
  diagram: SequenceDiagram,
  fontSize: number,
): SequenceDiagram {
  const l = diagram.layout!
  const k = fontSize / 16
  const w = l.width ?? 150
  const noteW = w * k
  const msgW = (w + (l.actorMargin ?? 50)) * k
  return {
    ...diagram,
    notes: diagram.notes.map((n) => ({
      ...n,
      text: wrapLabel(n.text, noteW, fontSize),
    })),
    messages: diagram.messages.map((m) => ({
      ...m,
      label: wrapLabel(m.label, msgW, fontSize),
    })),
  }
}

export function layoutSequenceDiagram(
  input: SequenceDiagram,
  options: SequenceRenderOptions = {},
): PositionedSequenceDiagram {
  const diagram = input.layout?.wrap
    ? wrapDiagramText(input, resolveFontSizes(options.fontSizes).edgeLabel)
    : input
  if (diagram.actors.length === 0) {
    return {
      width: 0,
      height: 0,
      actors: [],
      lifelines: [],
      messages: [],
      activations: [],
      blocks: [],
      notes: [],
      boxes: [],
      footerActors: [],
    }
  }

  const seq = resolveSeqOptions(options.sequence, diagram.layout)
  const alignOf = (v?: 'left' | 'center' | 'right') =>
    v === 'left' || v === 'right' ? v : undefined
  const noteAlign = alignOf(diagram.layout?.noteAlign)
  const msgAlign = alignOf(diagram.layout?.messageAlign)
  const fontSizes = resolveFontSizes(options.fontSizes)

  // 1. Calculate actor widths and assign horizontal positions (center X)
  const actorWidths = diagram.actors.map((a) => {
    const textW = estimateTextWidth(
      a.label,
      fontSizes.nodeLabel,
      FONT_WEIGHTS.nodeLabel,
    )
    return Math.max(textW + seq.actorPadX * 2, seq.actorMinWidth)
  })

  // Build actor center X positions with minimum gap, widened so message
  // labels fit between their lifelines (ported from lukilabs/beautiful-mermaid#167).
  const gaps = actorWidths.map((w, i) =>
    i === 0
      ? 0
      : Math.max(
          seq.actorGap,
          (actorWidths[i - 1]! + w) / 2 + 40 + (seq.actorGap - SEQ.actorGap),
        ),
  )
  fitLabelsBetweenLifelines(
    diagram,
    actorWidths,
    gaps,
    seq,
    fontSizes.edgeLabel,
  )
  const actorCenterX: number[] = []
  let currentX = seq.padding + actorWidths[0]! / 2
  for (let i = 0; i < diagram.actors.length; i++) {
    currentX += gaps[i]!
    actorCenterX.push(currentX)
  }

  // Build actor ID → index lookup
  const actorIndex = new Map<string, number>()
  for (let i = 0; i < diagram.actors.length; i++) {
    actorIndex.set(diagram.actors[i]!.id, i)
  }

  // 2. Position actors at the top. A `box … end` group draws a full-height
  //    background starting at the top padding, so when any (non-empty) box
  //    exists the actor row moves down to leave room for the box's top
  //    padding and — if any box has a label — its label band. Mermaid does
  //    the same (`bumpVerticalPos(boxes[0].textMaxHeight)`).
  const renderedBoxes = diagram.boxes.filter((b) => b.actorIds.length > 0)
  const anyBoxLabel = renderedBoxes.some((b) => b.label !== '')
  const boxTopInset =
    renderedBoxes.length === 0
      ? 0
      : seq.boxPad + (anyBoxLabel ? boxLabelHeight(fontSizes.edgeLabel) : 0)
  // A `title` line sits above the boxes and actors (as in Mermaid).
  const titleInset = diagram.title ? seq.titleBand : 0
  const top = seq.paddingY + titleInset
  const actorY = top + boxTopInset
  const actors: PositionedActor[] = diagram.actors.map((a, i) => ({
    id: a.id,
    label: a.label,
    type: a.type,
    ...(a.participantType !== undefined && {
      participantType: a.participantType,
    }),
    x: actorCenterX[i]!,
    y: actorY,
    width: actorWidths[i]!,
    height: seq.actorHeight,
  }))

  // Box backgrounds span from the outermost member's left edge to the
  // outermost member's right edge (plus padding) — any participant declared
  // between two members sits visually inside, as in Mermaid. Heights are
  // filled in once the diagram bottom is known (step 8 below).
  const boxes: PositionedParticipantBox[] = renderedBoxes.map((box) => {
    const idxs = box.actorIds.map((id) => actorIndex.get(id) ?? 0)
    const lo = Math.min(...idxs)
    const hi = Math.max(...idxs)
    const left = actorCenterX[lo]! - actorWidths[lo]! / 2 - seq.boxPad
    const right = actorCenterX[hi]! + actorWidths[hi]! / 2 + seq.boxPad
    const positioned: PositionedParticipantBox = {
      label: box.label,
      x: left,
      y: top,
      width: right - left,
      height: 0,
    }
    if (box.color !== undefined) positioned.color = box.color
    return positioned
  })

  // 3. Stack messages vertically. A stick-figure actor's label sits below its
  //    icon, in the gap before the first message; widen the gap so the label
  //    (and the first message's own label above its arrow) never touch.
  //    Participants created mid-diagram are placed at their creating message
  //    instead, so they don't take part in the header.
  const actorLabelBottoms = diagram.actors.map((a) =>
    hasLabelBelowIcon(a)
      ? actorLabelBottom(a.label, fontSizes.nodeLabel, FONT_WEIGHTS.nodeLabel)
      : 0,
  )
  const headerLabelBottom = Math.max(
    0,
    ...diagram.actors.map((a, i) =>
      a.createdAt === undefined ? actorLabelBottoms[i]! : 0,
    ),
  )
  const firstMessageLabelRoom = fontSizes.edgeLabel + 12
  let messageY =
    actorY +
    seq.actorHeight +
    Math.max(
      seq.headerGap,
      headerLabelBottom > 0
        ? headerLabelBottom + ACTOR_LABEL_CLEARANCE + firstMessageLabelRoom
        : 0,
    )
  const messages: PositionedMessage[] = []

  // Pre-scan blocks to determine which message indices need extra vertical
  // space for block headers (e.g. "alt [Valid credentials]") or divider
  // labels (e.g. "[else Invalid]"). Without this, messages inside blocks
  // overlap with the header/divider text that sits above them.
  const headerSpaceBefore = new Map<number, number>()
  const dividerSpaceBefore = new Map<number, number>()
  // Room a multi-line header label (or first message label) adds above a
  // block's first arrow, so the frame top can stay put (#2588).
  const startLabelExtra = new Map<number, number>()
  // Header and divider labels wrap to the frame (the lifelines it spans plus
  // its padding) rather than widening the participant gap (#2745).
  const wrappedLabels = diagram.blocks.map((block) => {
    const xs = diagram.messages
      .slice(block.startIndex, block.endIndex + 1)
      .flatMap((m) => [
        actorCenterX[actorIndex.get(m.from)!]!,
        actorCenterX[actorIndex.get(m.to)!]!,
      ])
    const span = xs.length
      ? Math.max(...xs) - Math.min(...xs)
      : actorCenterX[actorCenterX.length - 1]! - actorCenterX[0]!
    // Mermaid 12.3.0 wraps to roughly the lifeline span less 30px (floor
    // 80px) at 16px type, measured against its own text widths; this
    // renderer's narrower spans and type give 14px and 60px, which break the
    // same labels at the same words.
    const avail = Math.max(span - 14, 60)
    const wrap = (label: string) =>
      label ? wrapBracketed(label, avail, fontSizes.edgeLabel) : label
    return {
      label: wrap(block.label),
      dividers: block.dividers.map((d) => wrap(d.label)),
    }
  })
  diagram.blocks.forEach((block, bi) => {
    const holdsInner = diagram.blocks.some(
      (b, j) => j < bi && b.startIndex === block.startIndex,
    )
    const extra = dividerLabelExtra(
      wrappedLabels[bi]!.label,
      fontSizes.edgeLabel,
    )
    // Only the innermost header sits just above the message; an outer one
    // sits above the inner tab (see `blockTop` below).
    const labelGap = holdsInner ? 0 : seq.blockHeaderLabelGap
    startLabelExtra.set(
      block.startIndex,
      (startLabelExtra.get(block.startIndex) ?? 0) + extra + labelGap,
    )
    // First message in the block needs room for the block header label;
    // nested blocks opening at the same message stack their headers above it
    headerSpaceBefore.set(
      block.startIndex,
      (headerSpaceBefore.get(block.startIndex) ?? 0) +
        seq.blockHeaderExtra +
        extra +
        (holdsInner ? seq.blockNestedHeaderGap : labelGap),
    )

    // Each divider (else/and) needs room for the divider label
    for (const [di, div] of block.dividers.entries()) {
      // A nested block opening right below the divider has its own header
      // between the two, so it needs no extra gap.
      const opensBlock = diagram.blocks.some((b) => b.startIndex === div.index)
      dividerSpaceBefore.set(
        div.index,
        seq.dividerExtra +
          (opensBlock ? 0 : seq.dividerLabelGap) +
          dividerLabelExtra(
            wrappedLabels[bi]!.dividers[di],
            fontSizes.edgeLabel,
          ),
      )
    }
  })

  // Blocks closing after each message, and their bottom edges once placed
  const nested = nestedBlocks(diagram.blocks)
  const blocksEndingAt = new Map<number, number[]>()
  diagram.blocks.forEach((block, bi) => {
    const list = blocksEndingAt.get(block.endIndex) ?? []
    list.push(bi)
    blocksEndingAt.set(block.endIndex, list)
  })
  const blockBottoms: number[] = []
  const blockNotes = (block: (typeof diagram.blocks)[number]) =>
    diagram.notes.slice(block.noteStartIndex, block.noteEndIndex)

  // Pre-group notes by the message index they follow, so we can position
  // them inline during the message stacking loop (avoids overlap bugs).
  const notesByAfterIndex = new Map<number, typeof diagram.notes>()
  for (const note of diagram.notes) {
    const list = notesByAfterIndex.get(note.afterIndex) ?? []
    list.push(note)
    notesByAfterIndex.set(note.afterIndex, list)
  }
  const positionedNotes: PositionedNote[] = []

  // Place one note at `noteY` (its top edge) and return the y below it, where
  // the next stacked note starts.
  const notePositions = new Map<
    (typeof diagram.notes)[number],
    PositionedNote
  >()
  const placeNote = (note: (typeof diagram.notes)[number], noteY: number) => {
    let noteW = Math.max(
      seq.noteWidth,
      labelWidth(note.text, fontSizes.edgeLabel) + seq.notePadX * 2,
    )
    const noteLines = note.text.split('\n').length
    const noteH =
      fontSizes.edgeLabel * (1 + (noteLines - 1) * LINE_HEIGHT_RATIO) +
      seq.notePadY * 2

    // X positioning based on actor position and note type
    const firstActorIdx = actorIndex.get(note.actorIds[0] ?? '') ?? 0
    let noteX: number
    if (note.position === 'left') {
      noteX =
        actorCenterX[firstActorIdx]! -
        actorWidths[firstActorIdx]! / 2 -
        noteW -
        seq.noteGap
    } else if (note.position === 'right') {
      noteX =
        actorCenterX[firstActorIdx]! +
        actorWidths[firstActorIdx]! / 2 +
        seq.noteGap
    } else if (note.actorIds.length > 1) {
      // Over — center between first and last actor
      const lastActorIdx =
        actorIndex.get(note.actorIds[note.actorIds.length - 1] ?? '') ??
        firstActorIdx
      const c1 = actorCenterX[firstActorIdx]!
      const c2 = actorCenterX[lastActorIdx]!
      // Mermaid 12.3.0 spans the note across both lifelines, overhanging
      // each by 25px, and only grows past that for longer text (#2587).
      noteW = Math.max(noteW, Math.abs(c1 - c2) + 50)
      noteX = (c1 + c2) / 2 - noteW / 2
    } else {
      noteX = actorCenterX[firstActorIdx]! - noteW / 2
    }

    const positioned: PositionedNote = {
      text: note.text,
      x: noteX,
      y: noteY,
      width: noteW,
      height: noteH,
      position: note.position,
      actors: note.actorIds,
      ...(noteAlign && { align: noteAlign }),
    }
    positionedNotes.push(positioned)
    notePositions.set(note, positioned)
    return noteY + noteH + seq.noteStackGap
  }

  // Handle notes that appear before the first message (afterIndex === -1)
  const notesBeforeFirstMsg = notesByAfterIndex.get(-1)
  if (notesBeforeFirstMsg && notesBeforeFirstMsg.length > 0) {
    let noteY = messageY
    for (const note of notesBeforeFirstMsg) noteY = placeNote(note, noteY)
    messageY = Math.max(messageY, noteY + seq.messageRowHeight / 2)
  }

  // Track activation stack per actor: array of { startY, depth } objects
  // Depth is used to offset nested activations horizontally for visual clarity
  const activationStacks = new Map<
    string,
    { startY: number; depth: number }[]
  >()
  const activations: Activation[] = []
  // Horizontal offset per nesting level: half a bar, as official Mermaid does,
  // so a nested bar overlaps its parent by half instead of hiding behind it.
  const nestingOffset = seq.activationWidth / 2

  /** Open an activation bar on `actorId` at row `y` (stacks for nesting). */
  function startActivation(actorId: string, y: number, selfLoop = false): void {
    // Mermaid opens a bar after a self-message at the point below its loop
    // (loop height + 2), not at the loop's top row (#2743).
    const startY = selfLoop ? y + seq.selfMessageHeight + 2 : y
    const stack = activationStacks.get(actorId) ?? []
    activationStacks.set(actorId, stack)
    const depth = stack.length // Current depth before pushing
    stack.push({ startY, depth })
  }

  /**
   * Close the innermost open activation on `actorId` at row `y`. A
   * deactivate with nothing open is ignored rather than fatal (Mermaid
   * itself errors here; this renderer has always been lenient about it).
   */
  function endActivation(actorId: string, y: number, selfLoop = false): void {
    const endY = selfLoop ? y + seq.selfMessageHeight : y
    const stack = activationStacks.get(actorId)
    if (!stack || stack.length === 0) return
    const { startY, depth } = stack.pop()!
    const idx = actorIndex.get(actorId) ?? 0
    // Offset nested activations to the right for visual distinction
    const xOffset = depth * nestingOffset
    activations.push({
      actorId,
      x: actorCenterX[idx]! - seq.activationWidth / 2 + xOffset,
      topY: startY,
      bottomY: endY,
      width: seq.activationWidth,
      depth,
    })
  }

  /**
   * Standalone `activate`/`deactivate` statements, grouped by the message
   * they follow. Applied at that message's row — the same row the `+`/`-`
   * shorthand on that message would use — through the same two helpers, so
   * the two spellings can't drift apart.
   */
  const activationEventsByAfterIndex = new Map<
    number,
    typeof diagram.activations
  >()
  for (const event of diagram.activations) {
    const list = activationEventsByAfterIndex.get(event.afterIndex) ?? []
    list.push(event)
    activationEventsByAfterIndex.set(event.afterIndex, list)
  }
  function applyActivationEvents(
    afterIndex: number,
    y: number,
    selfLoop = false,
  ): void {
    for (const event of activationEventsByAfterIndex.get(afterIndex) ?? []) {
      if (event.kind === 'start') startActivation(event.actorId, y, selfLoop)
      else endActivation(event.actorId, y, selfLoop)
    }
  }

  // Events before the first message open at the top of the message area.
  applyActivationEvents(-1, messageY)

  const msgLabelExtra: number[] = []
  for (let msgIdx = 0; msgIdx < diagram.messages.length; msgIdx++) {
    const msg = diagram.messages[msgIdx]!
    const fromIdx = actorIndex.get(msg.from) ?? 0
    const toIdx = actorIndex.get(msg.to) ?? 0
    const isSelf = msg.from === msg.to

    // Add extra vertical space if this message sits below a block header or divider
    messageY +=
      (headerSpaceBefore.get(msgIdx) ?? 0) +
      (dividerSpaceBefore.get(msgIdx) ?? 0)

    // A multi-line label grows upward from the arrow, so its first line stays
    // where a one-line label's would and the arrow moves down (#2588).
    const labelExtra = dividerLabelExtra(msg.label, fontSizes.edgeLabel)
    messageY += labelExtra
    msgLabelExtra[msgIdx] = labelExtra

    const x1 = actorCenterX[fromIdx]!
    let x2 = actorCenterX[toIdx]!

    // A `create participant` message ends at the near edge of the box it
    // creates rather than at the lifeline centre — the box sits on this row
    // (see the created-actor placement after this loop), so an arrow to the
    // centre would run underneath it. Mermaid's renderer makes the same
    // adjustment (`receiverAdjustment(actor, width / 2)`).
    const createsRecipient =
      !isSelf && diagram.actors[toIdx]!.createdAt === msgIdx
    if (createsRecipient) {
      const halfW = actorWidths[toIdx]! / 2
      x2 += x1 < x2 ? -halfW : halfW
    }

    messages.push({
      from: msg.from,
      to: msg.to,
      label: msg.label,
      lineStyle: msg.lineStyle,
      arrowHead: msg.arrowHead,
      x1,
      x2,
      y: messageY,
      isSelf,
      bidirectional: msg.bidirectional ?? false,
      ...(msg.isLost && { isLost: true }),
      ...(msgAlign && { labelAlign: msgAlign }),
      ...(isSelf &&
        diagram.layout?.rightAngles && { rightAngles: true as const }),
      seqNumber: msg.seqNumber,
    })

    // Handle activation - track nesting depth for visual offset. The `+`
    // shorthand activates the recipient, `-` deactivates the sender (see
    // parser.ts); standalone statements following this message apply at
    // the same row, after the shorthand, in source order.
    if (msg.activate) startActivation(msg.to, messageY, isSelf)
    if (msg.deactivate) endActivation(msg.from, messageY, isSelf)
    applyActivationEvents(msgIdx, messageY, isSelf)

    // Advance messageY past the message itself
    messageY += isSelf
      ? seq.selfMessageHeight + seq.messageRowHeight
      : seq.messageRowHeight
    // The created box is centred on this row, so its lower half hangs
    // below the arrow — give the next row room to clear it (Mermaid bumps
    // by the same half-height after a creating message).
    if (createsRecipient) messageY += seq.actorHeight / 2

    // Close a block ending at this message so it holds its last message (and
    // a self-message loop), its notes and its nested blocks, then keep the
    // next message clear of its bottom edge (#2452).
    const closeBlock = (bi: number) => {
      let bottom =
        messages[msgIdx]!.y +
        (isSelf ? SELF_LOOP_HEIGHT : 0) +
        seq.blockPadBottom +
        12
      for (const note of blockNotes(diagram.blocks[bi]!)) {
        const n = notePositions.get(note)!
        bottom = Math.max(bottom, n.y + n.height + seq.blockPadBottom)
      }
      for (const ci of nested[bi]!) {
        bottom = Math.max(bottom, blockBottoms[ci]! + seq.blockPadBottom)
      }
      blockBottoms[bi] = bottom
      messageY = Math.max(messageY, bottom + seq.messageRowHeight / 2)
    }
    const closing = blocksEndingAt.get(msgIdx) ?? []

    // Position notes that appear after this message.
    // Notes start below the self-message loop (if self) or below the arrow,
    // and consecutive notes stack vertically. A note written after a block's
    // `end` sits below that block rather than on top of it. If notes extend
    // beyond the normal message advance, push messageY further so subsequent
    // messages don't overlap.
    const notesForMsg = notesByAfterIndex.get(msgIdx)
    if (notesForMsg && notesForMsg.length > 0) {
      // Self-message loops extend selfMessageHeight below msg.y;
      // normal arrows sit at msg.y with no extension below.
      const selfLoopExtra = isSelf ? seq.selfMessageHeight : 0
      let noteY =
        messages[msgIdx]!.y + selfLoopExtra + seq.noteOffsetAfterMessage

      for (const note of notesForMsg) {
        const at = diagram.notes.indexOf(note)
        for (const bi of closing) {
          if (
            blockBottoms[bi] === undefined &&
            diagram.blocks[bi]!.noteEndIndex <= at
          ) {
            closeBlock(bi)
            noteY = Math.max(
              noteY,
              blockBottoms[bi]! + seq.noteOffsetAfterMessage,
            )
          }
        }
        noteY = placeNote(note, noteY)
      }

      // Push messageY forward if notes extended beyond the normal advance.
      // Add half a row height so the next message's label (rendered at msg.y - 6)
      // has clearance from the last note's bottom edge.
      messageY = Math.max(messageY, noteY + seq.messageRowHeight / 2)
    }

    for (const bi of closing) {
      if (blockBottoms[bi] === undefined) closeBlock(bi)
    }
  }

  // Close any unclosed activations (preserving depth for offset)
  for (const [actorId, stack] of activationStacks) {
    for (const { startY, depth } of stack) {
      const idx = actorIndex.get(actorId) ?? 0
      const xOffset = depth * nestingOffset
      activations.push({
        actorId,
        x: actorCenterX[idx]! - seq.activationWidth / 2 + xOffset,
        topY: startY,
        bottomY: messageY - seq.messageRowHeight / 2,
        width: seq.activationWidth,
        depth,
      })
    }
  }

  // Paint outer bars before the bars nested inside them. Bars are pushed in
  // close order, so an inner one otherwise precedes (and is covered by) its
  // parent, which closes later. Array#sort is stable, so equal depths keep
  // their order.
  activations.sort((a, b) => a.depth - b.depth)

  // 4. Position blocks (loop/alt/opt), innermost first so a block can enclose
  //    the blocks nested inside it
  const blocks: PositionedBlock[] = []
  diagram.blocks.forEach((block, bi) => {
    const inner = nested[bi]!.map((ci) => blocks[ci]!)

    // Block spans from the Y of startIndex to endIndex messages, above the
    // header tabs of nested blocks that open at the same message
    const startMsg = messages[block.startIndex]
    let blockTop =
      (startMsg?.y ?? messageY) -
      seq.blockPadTop -
      startLabelExtra.get(block.startIndex)! -
      (msgLabelExtra[block.startIndex] ?? 0)
    for (const c of inner)
      blockTop = Math.min(
        blockTop,
        c.y - seq.blockHeaderExtra - seq.blockNestedHeaderGap,
      )
    // An empty block (no message closes it) ends below the last row
    const blockBottom = blockBottoms[bi] ?? messageY + seq.blockPadBottom + 12

    // Block width spans all actors involved in its messages
    const involvedActors = new Set<number>()
    for (let mi = block.startIndex; mi <= block.endIndex; mi++) {
      const m = diagram.messages[mi]
      if (m) {
        involvedActors.add(actorIndex.get(m.from) ?? 0)
        involvedActors.add(actorIndex.get(m.to) ?? 0)
      }
    }
    // Fallback: span all actors if none involved
    if (involvedActors.size === 0) {
      for (let ai = 0; ai < diagram.actors.length; ai++) involvedActors.add(ai)
    }
    const minIdx = Math.min(...involvedActors)
    const maxIdx = Math.max(...involvedActors)
    // The frame hugs the outermost lifelines, not the wider actor boxes
    // above them (mermaid.js does the same).
    const framePad = blockFramePad(seq)
    let blockLeft = actorCenterX[minIdx]! - framePad
    let blockRight = actorCenterX[maxIdx]! + framePad
    // A self-message loop swings out to the right of its lifeline, and its
    // label is centred on it.
    for (const m of diagram.messages.slice(
      block.startIndex,
      block.endIndex + 1,
    )) {
      if (m.from !== m.to) continue
      const cx = actorCenterX[actorIndex.get(m.from)!]!
      const half = labelWidth(m.label, fontSizes.edgeLabel) / 2
      blockLeft = Math.min(blockLeft, cx - half - seq.blockPadX)
      blockRight = Math.max(
        blockRight,
        cx + Math.max(SELF_LOOP_EXTENT, half) + seq.blockPadX,
      )
    }
    // Nested activation bars shift right with depth and can pass the edge.
    for (const act of activations) {
      const ai = actorIndex.get(act.actorId)!
      if (ai < minIdx || ai > maxIdx) continue
      if (act.topY >= blockBottom || act.bottomY <= blockTop) continue
      blockRight = Math.max(blockRight, act.x + act.width + seq.blockPadX)
    }

    // Widen to hold the notes and nested blocks inside it...
    for (const note of blockNotes(block)) {
      const n = notePositions.get(note)!
      blockLeft = Math.min(blockLeft, n.x - seq.blockPadX)
      blockRight = Math.max(blockRight, n.x + n.width + seq.blockPadX)
    }
    for (const c of inner) {
      blockLeft = Math.min(blockLeft, c.x - seq.blockPadX)
      blockRight = Math.max(blockRight, c.x + c.width + seq.blockPadX)
    }
    // Position dividers — offset from message Y so the divider label text
    // (rendered at divider.y + 14 in the renderer) clears the message label
    // (rendered at msg.y - 6).
    //
    // Default offset 28 gives ~8px baseline clearance, which is sufficient
    // when the divider label (left-aligned at block edge) and message label
    // (centered between actors) don't share horizontal space. When they DO
    // overlap horizontally (e.g. long divider labels like "[Account locked]"
    // next to centered message labels like "403 Forbidden"), we increase the
    // offset to 40 so text bounding boxes have ~5px visual clearance.
    const dividers = block.dividers.map((d, di) => {
      const dLabel = wrappedLabels[bi]!.dividers[di]!
      // A nested block opening right after the divider: sit above its header tab
      const opening = inner.filter(
        (_, k) => diagram.blocks[nested[bi]![k]!]!.startIndex === d.index,
      )
      if (opening.length > 0) {
        return {
          y: Math.min(...opening.map((c) => c.y)) - seq.dividerExtra,
          label: dLabel,
        }
      }

      const msg = messages[d.index]
      const msgY = msg?.y ?? messageY
      // The centred divider label sits on its own row above a message label
      // that is centred too, so a labelled message needs the taller offset.
      const offset =
        (d.label && msg?.label ? 40 : 28) +
        seq.dividerLabelGap +
        dividerLabelExtra(dLabel, fontSizes.edgeLabel) +
        (msgLabelExtra[d.index] ?? 0)

      return { y: msgY - offset, label: dLabel }
    })

    blocks.push({
      type: block.type,
      label: wrappedLabels[bi]!.label,
      ...(block.color !== undefined ? { color: block.color } : {}),
      x: blockLeft,
      y: blockTop,
      width: blockRight - blockLeft,
      height: blockBottom - blockTop,
      dividers,
    })
  })

  // 5. Notes — already positioned inline during the message stacking loop
  //    (step 3) to properly account for self-message loops and vertical stacking.
  const notes = positionedNotes

  // 6. Bounding-box post-processing
  //
  // Notes positioned "left of" the first actor or "right of" the last actor
  // can extend beyond the actor-based viewport. Compute the true bounding box
  // across all positioned elements, then shift everything right if anything
  // extends left of the desired padding margin and expand the width to fit.
  // The lifelines end where the mirrored footer actors begin; a stick figure
  // or typed icon keeps its label below the box, so the footer row grows by it.
  const lifelineBottom = messageY
  const mirror = diagram.mirrorActors !== false
  const footerLabelRoom = Math.max(
    0,
    ...diagram.actors.map((a, i) =>
      a.destroyedAt === undefined && actorLabelBottoms[i]! > 0
        ? actorLabelBottoms[i]! + ACTOR_LABEL_CLEARANCE
        : 0,
    ),
  )
  const diagramBottom =
    lifelineBottom +
    (mirror ? seq.actorHeight + footerLabelRoom : 0) +
    seq.paddingY +
    seq.bottomAdj

  // Find global X extents across actors, blocks, notes, and message labels
  let globalMinX: number = seq.padding // Actors already start at seq.padding
  let globalMaxX = 0
  for (const a of actors) {
    globalMinX = Math.min(globalMinX, a.x - a.width / 2)
    globalMaxX = Math.max(globalMaxX, a.x + a.width / 2)
  }
  for (const b of blocks) {
    globalMinX = Math.min(globalMinX, b.x)
    globalMaxX = Math.max(globalMaxX, b.x + b.width)
  }
  for (const n of notes) {
    globalMinX = Math.min(globalMinX, n.x)
    globalMaxX = Math.max(globalMaxX, n.x + n.width)
  }
  for (const b of boxes) {
    globalMinX = Math.min(globalMinX, b.x)
    globalMaxX = Math.max(globalMaxX, b.x + b.width)
  }
  // Include self-message loops and labels in bounding box — the loop hangs
  // right of the lifeline and the label is centred on it, so either could be
  // clipped by the SVG width (or the left edge) otherwise.
  for (const m of messages) {
    if (!m.isSelf) continue
    globalMaxX = Math.max(globalMaxX, m.x1 + SELF_LOOP_EXTENT + 8) // The loop width plus a margin
    if (m.label) {
      const half =
        estimateTextWidth(
          m.label,
          fontSizes.edgeLabel,
          FONT_WEIGHTS.edgeLabel,
        ) /
          2 +
        8 // +8 for safety margin
      globalMaxX = Math.max(globalMaxX, m.x1 + half)
      globalMinX = Math.min(globalMinX, m.x1 - half)
    }
  }

  // If elements extend left of the desired padding, shift everything right
  const shiftX = globalMinX < seq.padding ? seq.padding - globalMinX : 0
  if (shiftX > 0) {
    for (const a of actors) a.x += shiftX
    for (const m of messages) {
      m.x1 += shiftX
      m.x2 += shiftX
    }
    for (const act of activations) act.x += shiftX
    for (const b of blocks) {
      b.x += shiftX
    }
    for (const n of notes) n.x += shiftX
    for (const b of boxes) b.x += shiftX
    // Also shift actor center X array (used for lifelines below)
    for (let i = 0; i < actorCenterX.length; i++) actorCenterX[i]! += shiftX
  }

  // 7. Participant lifecycle: a created participant's box moves from the
  //    header down to its creating message's row, centred on the arrow
  //    (Mermaid: `actor.starty = lineStartY - actor.height / 2`), and a
  //    destroyed participant's lifeline stops at its destroying message.
  //    Both indices come from the parser, which already verified the
  //    message exists and involves the actor — the `?? messageY` fallbacks
  //    only guard the type, not a reachable state.
  for (let i = 0; i < diagram.actors.length; i++) {
    const createdAt = diagram.actors[i]!.createdAt
    if (createdAt !== undefined) {
      actors[i]!.y = (messages[createdAt]?.y ?? messageY) - seq.actorHeight / 2
    }
  }

  // 8. Calculate final lifelines (after shift so X positions are correct)
  const lifelines: Lifeline[] = diagram.actors.map((a, i) => {
    const destroyedAt = a.destroyedAt
    const lifeline: Lifeline = {
      actorId: a.id,
      x: actorCenterX[i]!,
      // A stick-figure actor's label sits on the lifeline's axis just below
      // the icon, so the line starts under it rather than through it.
      topY:
        actors[i]!.y +
        seq.actorHeight +
        (actorLabelBottoms[i]! > 0
          ? actorLabelBottoms[i]! + ACTOR_LABEL_CLEARANCE
          : 0),
      bottomY:
        destroyedAt === undefined
          ? lifelineBottom
          : (messages[destroyedAt]?.y ?? messageY) -
            (mirror ? seq.actorHeight / 2 : 0),
    }
    if (destroyedAt !== undefined) lifeline.destroyed = true
    return lifeline
  })

  // Mermaid mirrors every participant along the bottom of the lifelines; a
  // destroyed one's footer box sits at its destroying message instead, centred
  // on the arrow (`actor.stopy = lineStartY - actor.height / 2`), and its
  // lifeline ends at the box top (no cross: the `-x` message end is the only one).
  const footerActors = actors
    .map((a, i) => {
      const destroyedAt = diagram.actors[i]!.destroyedAt
      return destroyedAt === undefined
        ? { ...a, y: lifelineBottom }
        : { ...a, y: lifelines[i]!.bottomY }
    })
    .filter(() => mirror)

  // Box backgrounds run from the top padding to just under the footer
  // actors (boxPad < padding, so this stays inside the diagram height).
  for (const b of boxes) {
    b.height = diagramBottom - seq.paddingY - seq.bottomAdj + seq.boxPad - b.y
  }

  // 9. Calculate diagram dimensions from the bounding box
  const titleWidth = diagram.title
    ? measureMultilineText(
        diagram.title,
        TITLE_FONT_SIZE,
        FONT_WEIGHTS.groupHeader,
      ).width +
      2 * seq.padding
    : 0
  const diagramWidth = globalMaxX + shiftX + seq.padding
  const diagramHeight = diagramBottom

  return {
    width: Math.max(diagramWidth, titleWidth, 200),
    height: Math.max(diagramHeight, 100),
    actors,
    lifelines,
    messages,
    activations,
    blocks,
    notes,
    boxes,
    footerActors,
    ...(diagram.title && {
      title: { text: diagram.title, y: seq.paddingY + TITLE_FONT_SIZE / 2 },
    }),
  }
}
