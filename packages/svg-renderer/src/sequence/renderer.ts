import type {
  PositionedSequenceDiagram,
  PositionedActor,
  Lifeline,
  PositionedMessage,
  Activation,
  PositionedBlock,
  PositionedNote,
  PositionedParticipantBox,
} from '@zombie-mermaid/mermaid-parser'
import { ACTOR_LABEL_OFFSET, boxLabelHeight } from './layout.ts'
import type { DiagramColors, SvgEmitOptions } from '@zombie-mermaid/core'
import {
  svgOpenTag,
  buildStyleBlock,
  renderMultilineText,
  measureMultilineText,
  escapeAttr,
  f,
} from '@zombie-mermaid/core'
import { withDataSrc } from '../renderer.ts'
import {
  FONT_SIZES,
  FONT_WEIGHTS,
  STROKE_WIDTHS,
  ARROW_HEAD,
  estimateTextWidth,
} from '../styles.ts'
import type { FontSizes } from '../styles.ts'

// ============================================================================
// Sequence diagram SVG renderer
//
// Renders a positioned sequence diagram to SVG string.
// All colors use CSS custom properties (var(--_xxx)) from the theme system.
//
// Render order (back to front):
//   0. Participant-group backgrounds (box … end)
//   1. Block backgrounds (loop/alt/opt)
//   2. Lifelines (dashed vertical lines)
//   3. Activation boxes
//   4. Messages (arrows with labels)
//   5. Notes
//   6. Actor boxes (at top)
// ============================================================================

/**
 * Render a positioned sequence diagram as an SVG string.
 *
 * @param colors - DiagramColors with bg/fg and optional enrichment variables.
 * @param transparent - If true, renders with transparent background.
 * @param embedSource - Original diagram source to stamp onto the root `<svg>`
 *                       as `data-src` (from `options.embedSource`). Omitted
 *                       when the option is off.
 * @param title - Accessible name (from `options.title`). See svgOpenTag() in
 *                packages/core/src/theme.ts.
 * @param decorative - Marks the SVG decorative (from `options.decorative`).
 * @param emit - Strict-CSP controls (from `options.nonce` /
 *               `options.styleAttribute`, see #216). Default: no nonce,
 *               root `style` attribute on.
 */
export function renderSequenceSvg(
  diagram: PositionedSequenceDiagram,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
  fontSizes: FontSizes = FONT_SIZES,
  embedSource?: string,
  title?: string,
  decorative?: boolean,
  emit: SvgEmitOptions = {},
): string {
  const parts: string[] = []

  // SVG root with CSS variables + style block + defs
  parts.push(
    withDataSrc(
      svgOpenTag(
        diagram.width,
        diagram.height,
        colors,
        transparent,
        title,
        decorative,
        undefined,
        emit.styleAttribute,
      ),
      embedSource,
    ),
  )
  parts.push(buildStyleBlock(font, false, emit.nonce))
  parts.push('<defs>')

  // Arrow marker definitions
  parts.push(arrowMarkerDefs())
  parts.push('</defs>')

  // 0. Participant-group backgrounds (box … end), behind everything
  for (const box of diagram.boxes) {
    parts.push(renderParticipantBox(box, fontSizes))
  }

  // 1. Block backgrounds (loop/alt/opt rectangles)
  for (const block of diagram.blocks) {
    parts.push(renderBlock(block, fontSizes))
  }

  // 2. Lifelines (dashed vertical lines from actor to bottom), interrupted
  //    where a message / block label sits on them so no line runs through text
  const labelBoxes = collectLabelBoxes(diagram, fontSizes)
  for (const lifeline of diagram.lifelines) {
    parts.push(renderLifeline(lifeline, labelBoxes))
  }

  // 3. Activation boxes
  for (const activation of diagram.activations) {
    parts.push(renderActivation(activation))
  }

  // 4. Messages (horizontal arrows with labels)
  for (const message of diagram.messages) {
    parts.push(renderMessage(message, fontSizes))
  }

  // 5. Notes
  for (const note of diagram.notes) {
    parts.push(renderNote(note, fontSizes))
  }

  // 6. Actor boxes at top (rendered last so they're on top)
  for (const actor of diagram.actors) {
    parts.push(renderActor(actor, fontSizes))
  }

  parts.push('</svg>')
  return parts.join('\n')
}

// ============================================================================
// Arrow marker definitions
// ============================================================================

function arrowMarkerDefs(): string {
  const w = ARROW_HEAD.width
  const h = ARROW_HEAD.height
  return (
    f`  <marker id="seq-arrow" markerWidth="${w}" markerHeight="${h}" refX="${w}" refY="${h / 2}" orient="auto-start-reverse">` +
    f`\n    <polygon points="0 0, ${w} ${h / 2}, 0 ${h}" fill="var(--_arrow)" />` +
    `\n  </marker>` +
    // Open arrow head (just lines, no fill)
    f`\n  <marker id="seq-arrow-open" markerWidth="${w}" markerHeight="${h}" refX="${w}" refY="${h / 2}" orient="auto-start-reverse">` +
    f`\n    <polyline points="0 0, ${w} ${h / 2}, 0 ${h}" fill="none" stroke="var(--_arrow)" stroke-width="1" />` +
    `\n  </marker>`
  )
}

// ============================================================================
// Component renderers
// ============================================================================

/**
 * Render an actor box (participant = rectangle, actor = stick figure).
 * Wrapped in <g class="actor"> with semantic data attributes.
 */
function renderActor(actor: PositionedActor, fontSizes: FontSizes): string {
  const { id, x, y, width, height, label, type } = actor
  const parts: string[] = []

  // Semantic wrapper with actor metadata
  parts.push(
    f`<g class="actor" data-id="${escapeAttr(id)}" data-label="${escapeAttr(label)}" data-type="${type}">`,
  )

  if (type === 'actor') {
    // Circle-person icon: outer circle + head circle + shoulders arc.
    // Defined in a 24×24 coordinate space, scaled to 90% of the actor box height
    // and centered both horizontally and vertically within the box.
    // Stroke width is inverse-scaled so the visual thickness matches STROKE_WIDTHS.outerBox.
    const s = (height / 24) * 0.9
    const tx = x - 12 * s // center icon horizontally on actor.x
    const ty = y + (height - 24 * s) / 2 // center icon vertically in actor box
    const sw = STROKE_WIDTHS.outerBox / s // compensate for scale transform
    const iconStroke = 'var(--_line)' // use line color for actor icon strokes

    parts.push(
      f`  <g transform="translate(${tx},${ty}) scale(${s})">` +
        // Outer circle
        f`\n    <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" fill="none" stroke="${iconStroke}" stroke-width="${sw}" />` +
        // Head
        f`\n    <path d="M15 10C15 11.6569 13.6569 13 12 13C10.3431 13 9 11.6569 9 10C9 8.34315 10.3431 7 12 7C13.6569 7 15 8.34315 15 10Z" fill="none" stroke="${iconStroke}" stroke-width="${sw}" />` +
        // Shoulders
        f`\n    <path d="M5.62842 18.3563C7.08963 17.0398 9.39997 16 12 16C14.6 16 16.9104 17.0398 18.3716 18.3563" fill="none" stroke="${iconStroke}" stroke-width="${sw}" />` +
        `\n  </g>`,
    )
    // Label below the icon (supports multi-line)
    parts.push(
      '  ' +
        renderMultilineText(
          label,
          x,
          y + height + ACTOR_LABEL_OFFSET,
          fontSizes.nodeLabel,
          f`font-size="${fontSizes.nodeLabel}" text-anchor="middle" font-weight="${FONT_WEIGHTS.nodeLabel}" fill="var(--_text)"`,
        ),
    )
  } else {
    // Participant: rectangle box with label (supports multi-line)
    const boxX = x - width / 2
    parts.push(
      f`  <rect x="${boxX}" y="${y}" width="${width}" height="${height}" rx="4" ry="4" ` +
        f`fill="var(--_node-fill)" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.outerBox}" />`,
    )
    parts.push(
      '  ' +
        renderMultilineText(
          label,
          x,
          y + height / 2,
          fontSizes.nodeLabel,
          f`font-size="${fontSizes.nodeLabel}" text-anchor="middle" font-weight="${FONT_WEIGHTS.nodeLabel}" fill="var(--_text)"`,
        ),
    )
  }

  parts.push('</g>')
  return parts.join('\n')
}

/** Self-message loop width, height, and the gap before its label, in px. */
const SELF_LOOP_WIDTH = 30
const SELF_LOOP_HEIGHT = 20
const SELF_LABEL_PADDING = 8

/** How far above its arrow a message label's centre sits, in px. */
const MESSAGE_LABEL_RISE = 10

/** Height of a block's type-label tab, in px. */
const BLOCK_TAB_HEIGHT = 18

/** A rectangle some text occupies; lifelines are cut around it. */
interface LabelBox {
  x0: number
  x1: number
  y0: number
  y1: number
}

/** Breathing room kept between a label and the lifeline segments around it. */
const LIFELINE_LABEL_PAD_X = 3
const LIFELINE_LABEL_PAD_Y = 2

/** Lifeline fragments shorter than this are dropped rather than drawn as a stub. */
const LIFELINE_MIN_SEGMENT = 3

/**
 * Footprints of every text label a lifeline can run through: message labels
 * (above the arrow, or beside a self-message loop), the block type tab, and
 * block divider (`else` / `and`) labels. Mirrors the positions
 * {@link renderMessage} and {@link renderBlock} draw them at (#1242).
 */
function collectLabelBoxes(
  diagram: PositionedSequenceDiagram,
  fontSizes: FontSizes,
): LabelBox[] {
  const boxes: LabelBox[] = []
  const measure = (text: string) =>
    measureMultilineText(text, fontSizes.edgeLabel, FONT_WEIGHTS.edgeLabel)
  const centred = (text: string, cx: number, cy: number) => {
    const m = measure(text)
    boxes.push({
      x0: cx - m.width / 2,
      x1: cx + m.width / 2,
      y0: cy - m.height / 2,
      y1: cy + m.height / 2,
    })
  }
  const startAnchored = (text: string, x: number, cy: number) => {
    const m = measure(text)
    boxes.push({
      x0: x,
      x1: x + m.width,
      y0: cy - m.height / 2,
      y1: cy + m.height / 2,
    })
  }

  for (const msg of diagram.messages) {
    if (!msg.label) continue
    if (msg.isSelf) {
      startAnchored(
        msg.label,
        msg.x1 + SELF_LOOP_WIDTH + SELF_LABEL_PADDING,
        msg.y + SELF_LOOP_HEIGHT / 2,
      )
    } else {
      centred(msg.label, (msg.x1 + msg.x2) / 2, msg.y - MESSAGE_LABEL_RISE)
    }
  }

  for (const block of diagram.blocks) {
    const tab = `${block.type}${block.label ? ` [${block.label}]` : ''}`
    const tabWidth =
      estimateTextWidth(
        tab.split('\n')[0] ?? '',
        fontSizes.edgeLabel,
        FONT_WEIGHTS.groupHeader,
      ) + 16
    boxes.push({
      x0: block.x,
      x1: block.x + tabWidth,
      y0: block.y,
      y1: block.y + BLOCK_TAB_HEIGHT,
    })
    for (const divider of block.dividers) {
      if (!divider.label) continue
      startAnchored(`[${divider.label}]`, block.x + 8, divider.y + 14)
    }
  }
  return boxes
}

/**
 * The y-ranges of `lifeline` left after cutting out every label box it
 * crosses, as `[y0, y1]` pairs top to bottom.
 */
function lifelineSegments(
  lifeline: Lifeline,
  labelBoxes: readonly LabelBox[],
): Array<[number, number]> {
  const cuts = labelBoxes
    .filter(
      (b) =>
        lifeline.x > b.x0 - LIFELINE_LABEL_PAD_X &&
        lifeline.x < b.x1 + LIFELINE_LABEL_PAD_X &&
        b.y1 + LIFELINE_LABEL_PAD_Y > lifeline.topY &&
        b.y0 - LIFELINE_LABEL_PAD_Y < lifeline.bottomY,
    )
    .map((b): [number, number] => [
      b.y0 - LIFELINE_LABEL_PAD_Y,
      b.y1 + LIFELINE_LABEL_PAD_Y,
    ])
    .sort((a, b) => a[0] - b[0])

  const segments: Array<[number, number]> = []
  let cursor = lifeline.topY
  for (const [c0, c1] of cuts) {
    if (c0 - cursor >= LIFELINE_MIN_SEGMENT) segments.push([cursor, c0])
    cursor = Math.max(cursor, c1)
  }
  if (lifeline.bottomY - cursor >= LIFELINE_MIN_SEGMENT) {
    segments.push([cursor, lifeline.bottomY])
  }
  // A lifeline entirely under a label (or otherwise shorter than a stub)
  // would vanish; keep it whole rather than drop the participant's line.
  return segments.length > 0 ? segments : [[lifeline.topY, lifeline.bottomY]]
}

/**
 * Render a lifeline (dashed vertical line from actor to bottom), as one
 * `<line>` per stretch between label boxes it would otherwise pass through.
 * Includes data-actor to link to its actor.
 */
function renderLifeline(
  lifeline: Lifeline,
  labelBoxes: readonly LabelBox[],
): string {
  const line = lifelineSegments(lifeline, labelBoxes)
    .map(
      ([y0, y1]) =>
        f`<line class="lifeline" data-actor="${escapeAttr(lifeline.actorId)}" ` +
        f`x1="${lifeline.x}" y1="${y0}" x2="${lifeline.x}" y2="${y1}" ` +
        `stroke="var(--_line)" stroke-width="0.75" stroke-dasharray="6 4" />`,
    )
    .join('\n')
  if (!lifeline.destroyed) return line
  // `destroy X`: the lifeline ends at the destroying message's row, marked
  // with a cross centred on it — the same glyph Mermaid uses. Drawn in the
  // lifeline pass (before messages), so the destroying arrow lands on top.
  const { x, bottomY: y } = lifeline
  const r = DESTROY_CROSS_HALF
  return (
    line +
    f`\n<path class="destroy" data-actor="${escapeAttr(lifeline.actorId)}" ` +
    f`d="M${x - r} ${y - r} L${x + r} ${y + r} M${x + r} ${y - r} L${x - r} ${y + r}" ` +
    f`fill="none" stroke="var(--_line)" stroke-width="${STROKE_WIDTHS.outerBox}" stroke-linecap="round" />`
  )
}

/** Half-size of the `destroy` cross at the end of a lifeline, in px. */
const DESTROY_CROSS_HALF = 8

/**
 * Render an activation box (narrow filled rectangle on lifeline).
 * Includes data-actor to link to its actor.
 */
function renderActivation(activation: Activation): string {
  return (
    f`<rect class="activation" data-actor="${escapeAttr(activation.actorId)}" ` +
    f`x="${activation.x}" y="${activation.topY}" width="${activation.width}" height="${activation.bottomY - activation.topY}" ` +
    f`fill="var(--_node-fill)" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.innerBox}" />`
  )
}

/**
 * Render a message arrow with label.
 * Wrapped in <g class="message"> with semantic data attributes.
 */
function renderMessage(msg: PositionedMessage, fontSizes: FontSizes): string {
  const parts: string[] = []
  const dashArray = msg.lineStyle === 'dashed' ? ' stroke-dasharray="6 4"' : ''
  const markerId = msg.arrowHead === 'filled' ? 'seq-arrow' : 'seq-arrow-open'
  // Bidirectional arrows (`<<->>` / `<<-->>`) reuse the same marker on both
  // ends — the marker defs use orient="auto-start-reverse", which SVG
  // automatically flips 180° for marker-start so it points outward at the
  // line's start instead of reusing the marker-end orientation.
  const markerStart = msg.bidirectional
    ? f` marker-start="url(#${markerId})"`
    : ''

  // Semantic wrapper with message metadata
  parts.push(
    f`<g class="message" data-from="${escapeAttr(msg.from)}" data-to="${escapeAttr(msg.to)}" ` +
      f`data-label="${escapeAttr(msg.label)}" data-line-style="${msg.lineStyle}" ` +
      f`data-arrow-head="${msg.arrowHead}" data-self="${msg.isSelf}" data-bidirectional="${msg.bidirectional}">`,
  )

  if (msg.isSelf) {
    // Self-message: curved loop going right and back
    // Loop dimensions - loopH is fixed, loopW provides minimum clearance
    const loopW = SELF_LOOP_WIDTH
    const loopH = SELF_LOOP_HEIGHT
    const labelPadding = SELF_LABEL_PADDING // Space between loop and label
    parts.push(
      f`  <polyline points="${msg.x1},${msg.y} ${msg.x1 + loopW},${msg.y} ${msg.x1 + loopW},${msg.y + loopH} ${msg.x2},${msg.y + loopH}" ` +
        f`fill="none" stroke="var(--_line)" stroke-width="${STROKE_WIDTHS.connector}"${dashArray} marker-end="url(#${markerId})"${markerStart} />`,
    )
    // Label to the right of the loop (supports multi-line)
    parts.push(
      '  ' +
        renderMultilineText(
          msg.label,
          msg.x1 + loopW + labelPadding,
          msg.y + loopH / 2,
          fontSizes.edgeLabel,
          f`font-size="${fontSizes.edgeLabel}" text-anchor="start" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="var(--_text-muted)"`,
        ),
    )
  } else {
    // Normal message: horizontal arrow
    parts.push(
      f`  <line x1="${msg.x1}" y1="${msg.y}" x2="${msg.x2}" y2="${msg.y}" ` +
        f`stroke="var(--_line)" stroke-width="${STROKE_WIDTHS.connector}"${dashArray} marker-end="url(#${markerId})"${markerStart} />`,
    )
    // Label above the arrow, centered (supports multi-line)
    const midX = (msg.x1 + msg.x2) / 2
    parts.push(
      '  ' +
        renderMultilineText(
          msg.label,
          midX,
          msg.y - MESSAGE_LABEL_RISE,
          fontSizes.edgeLabel,
          f`font-size="${fontSizes.edgeLabel}" text-anchor="middle" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="var(--_text-muted)"`,
        ),
    )
  }

  if (msg.seqNumber !== undefined) {
    parts.push('  ' + renderSeqNumberBadge(msg, fontSizes))
  }

  parts.push('</g>')
  return parts.join('\n')
}

/**
 * Render the small `autonumber` badge Mermaid draws near the start of a
 * message arrow: a circle with the sequence number centered inside it,
 * layered on top of the arrow rather than folded into the label text.
 */
function renderSeqNumberBadge(
  msg: PositionedMessage,
  fontSizes: FontSizes,
): string {
  const radius = 8
  const fontSize = Math.max(fontSizes.edgeLabel - 2, 8)
  // Bidirectional messages also draw an arrowhead at x1 (the departure
  // end) — badge-at-x1 would sit on top of it. Shift the badge into the
  // arrow span, clear of the marker, in that case. One-way messages have
  // no marker at x1, so they keep the badge exactly at the departure
  // point as before.
  const cx = msg.bidirectional
    ? msg.x1 + Math.sign(msg.x2 - msg.x1) * (radius + ARROW_HEAD.width)
    : msg.x1
  return (
    `<g class="seq-number">` +
    f`<circle cx="${cx}" cy="${msg.y}" r="${radius}" fill="var(--bg)" stroke="var(--_arrow)" stroke-width="${STROKE_WIDTHS.innerBox}" />` +
    renderMultilineText(
      String(msg.seqNumber),
      cx,
      msg.y,
      fontSize,
      f`font-size="${fontSize}" text-anchor="middle" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="var(--_arrow)"`,
    ) +
    `</g>`
  )
}

/**
 * How much of a `box` colour shows through: the colour is mixed into the
 * theme background at this percentage rather than painted as-is, so
 * `box Purple` reads as a purple tint on a light theme and a deep purple on
 * a dark one instead of the same opaque swatch on both (Mermaid paints the
 * literal colour). The stroke and label use theme variables, so a colourless
 * box still shows its grouping in every theme.
 */
const BOX_COLOR_MIX_PERCENT = 35

/**
 * Render a `box … end` participant-group background: a full-height rect
 * behind the grouped lifelines with the label centred in its top band.
 * Wrapped in <g class="participant-box"> with semantic data attributes.
 *
 * `box.color` is emitted verbatim inside `color-mix()` — safe because the
 * parser only records a value that matched its fixed named-colour list or
 * the hex / rgb() / hsl() patterns (see box-color.ts), never arbitrary
 * diagram text.
 */
function renderParticipantBox(
  box: PositionedParticipantBox,
  fontSizes: FontSizes,
): string {
  const labelAttr = box.label ? f` data-label="${escapeAttr(box.label)}"` : ''
  const colorAttr =
    box.color !== undefined ? f` data-color="${escapeAttr(box.color)}"` : ''
  const fill =
    box.color !== undefined
      ? f`color-mix(in srgb, ${escapeAttr(box.color)} ${BOX_COLOR_MIX_PERCENT}%, var(--bg))`
      : 'none'
  const parts: string[] = [
    f`<g class="participant-box"${labelAttr}${colorAttr}>`,
    f`  <rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="4" ry="4" ` +
      f`fill="${fill}" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.innerBox}" />`,
  ]
  if (box.label) {
    // Centred in the label band the layout reserved above the actor boxes.
    parts.push(
      '  ' +
        renderMultilineText(
          box.label,
          box.x + box.width / 2,
          box.y + boxLabelHeight(fontSizes.edgeLabel) / 2,
          fontSizes.edgeLabel,
          f`font-size="${fontSizes.edgeLabel}" text-anchor="middle" font-weight="${FONT_WEIGHTS.groupHeader}" fill="var(--_text-sec)"`,
        ),
    )
  }
  parts.push('</g>')
  return parts.join('\n')
}

/**
 * Render a block background (loop/alt/opt).
 * Wrapped in <g class="block"> with semantic data attributes.
 */
function renderBlock(block: PositionedBlock, fontSizes: FontSizes): string {
  const parts: string[] = []

  // Semantic wrapper with block metadata
  const labelAttr = block.label
    ? f` data-label="${escapeAttr(block.label)}"`
    : ''
  parts.push(
    f`<g class="block" data-type="${escapeAttr(block.type)}"${labelAttr}>`,
  )

  // Outer rectangle
  parts.push(
    f`  <rect x="${block.x}" y="${block.y}" width="${block.width}" height="${block.height}" ` +
      f`rx="0" ry="0" fill="none" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.outerBox}" />`,
  )

  // Type label tab (top-left corner)
  // For multi-line block labels, we use the first line for the tab but show full label
  const labelText = f`${block.type}${block.label ? f` [${block.label}]` : ''}`
  // Audited for issue #100: `String.prototype.split` always returns an
  // array with at least one element (even splitting `''` yields `['']`),
  // so index 0 is guaranteed to exist regardless of whether `labelText`
  // contains a newline. `noUncheckedIndexedAccess` can't see that
  // language-level guarantee; left as-is, no behavior change.
  const firstLine = labelText.split('\n')[0]!
  const tabWidth =
    estimateTextWidth(
      firstLine,
      fontSizes.edgeLabel,
      FONT_WEIGHTS.groupHeader,
    ) + 16
  const tabHeight = BLOCK_TAB_HEIGHT

  parts.push(
    f`  <rect x="${block.x}" y="${block.y}" width="${tabWidth}" height="${tabHeight}" ` +
      f`fill="var(--_group-hdr)" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.outerBox}" />`,
  )
  // Block type label (supports multi-line via <br> tags)
  parts.push(
    '  ' +
      renderMultilineText(
        labelText,
        block.x + 6,
        block.y + tabHeight / 2,
        fontSizes.edgeLabel,
        f`font-size="${fontSizes.edgeLabel}" font-weight="${FONT_WEIGHTS.groupHeader}" fill="var(--_text-sec)"`,
      ),
  )

  // Divider lines (for alt/else, par/and)
  for (const divider of block.dividers) {
    parts.push(
      f`  <line x1="${block.x}" y1="${divider.y}" x2="${block.x + block.width}" y2="${divider.y}" ` +
        `stroke="var(--_line)" stroke-width="0.75" stroke-dasharray="6 4" />`,
    )
    if (divider.label) {
      // Divider label supports multi-line
      parts.push(
        '  ' +
          renderMultilineText(
            f`[${divider.label}]`,
            block.x + 8,
            divider.y + 14,
            fontSizes.edgeLabel,
            f`font-size="${fontSizes.edgeLabel}" text-anchor="start" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="var(--_text-muted)"`,
          ),
      )
    }
  }

  parts.push('</g>')
  return parts.join('\n')
}

/**
 * Render a note box.
 * Wrapped in <g class="note"> with semantic data attributes.
 */
function renderNote(note: PositionedNote, fontSizes: FontSizes): string {
  // Dog-ear note: polygon with clipped top-right corner + fold triangle
  const foldSize = 6
  const { x, y, width: w, height: h } = note

  // Build actor reference attribute if present
  const actorsAttr =
    note.actors && note.actors.length > 0
      ? f` data-actors="${note.actors.map(escapeAttr).join(',')}"`
      : ''
  const positionAttr = note.position
    ? f` data-position="${escapeAttr(note.position)}"`
    : ''

  // Note body: polygon with top-right corner cut off
  //   (x,y) → (x+w-fold,y) → (x+w,y+fold) → (x+w,y+h) → (x,y+h)
  const bodyPoints = [
    f`${x},${y}`,
    f`${x + w - foldSize},${y}`,
    f`${x + w},${y + foldSize}`,
    f`${x + w},${y + h}`,
    f`${x},${y + h}`,
  ].join(' ')

  return (
    f`<g class="note"${positionAttr}${actorsAttr}>` +
    // Note body with bg fill and clipped corner
    f`\n  <polygon points="${bodyPoints}" ` +
    f`fill="var(--bg)" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.innerBox}" />` +
    // Fold triangle (the folded-over corner)
    f`\n  <polygon points="${x + w - foldSize},${y} ${x + w},${y + foldSize} ${x + w - foldSize},${y + foldSize}" ` +
    f`fill="var(--_inner-stroke)" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.innerBox}" />` +
    // Note text (supports multi-line)
    f`\n  ${renderMultilineText(
      note.text,
      x + w / 2,
      y + h / 2,
      fontSizes.edgeLabel,
      f`font-size="${fontSizes.edgeLabel}" text-anchor="middle" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="var(--_text-muted)"`,
    )}` +
    `\n</g>`
  )
}
