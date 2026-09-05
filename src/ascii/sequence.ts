// ============================================================================
// ASCII renderer — sequence diagrams
//
// Renders sequenceDiagram text to ASCII/Unicode art using a column-based layout.
// Each actor occupies a column with a vertical lifeline; messages are horizontal
// arrows between lifelines. Blocks (loop/alt/opt/par) wrap around message groups.
//
// Layout is fundamentally different from flowcharts — no grid or A* pathfinding.
// Instead: actors → columns, messages → rows, all positioned linearly.
// ============================================================================

import { parseSequenceDiagram } from '../sequence/parser.ts'
import type { Block } from '../sequence/types.ts'
import type { AsciiConfig, CharRole, AsciiTheme, ColorMode } from './types.ts'
import {
  mkCanvas,
  mkRoleCanvas,
  canvasToString,
  getCanvasSize,
  increaseSize,
  increaseRoleCanvasSize,
  write,
} from './canvas.ts'
import { splitLines, maxLineWidth, lineCount } from './multiline-utils.ts'
import { splitStatements } from '../statements.ts'
import {
  displayWidth,
  toDisplayCells,
  WIDE_CHAR_PLACEHOLDER,
} from './display-width.ts'
import type { Message } from '../sequence/types.ts'
import { DEFAULT_PADDING_X, DEFAULT_PADDING_Y, paddingOffset } from './types.ts'

// Width of a self-message's loop glyphs (├──┐ / ◀──┘), excluding the label.
// Shared between the drawing pass and the block-wall extent calculation so
// self-arrows inside alt/loop/opt blocks don't get clipped by the wall.
const SELF_LOOP_WIDTH = 4

// Small stick-figure glyph drawn above an `actor`-kind participant's label
// (inside the same bordered box a `participant` gets), so mermaid's two
// declaration keywords stay visually distinct in ASCII output the way real
// mermaid.js's SVG renderer distinguishes them (a circle-person icon vs. a
// plain box) — see issue #449. Plain ASCII already, so — unlike H/V/TL/etc.
// above — there's no separate useAscii/unicode variant to pick between.
const ACTOR_GLYPH_LINES = ['O', '/|\\', '/ \\']
const ACTOR_GLYPH_WIDTH = 3

// Horizontal clearance between a block's (loop/alt/opt/par/etc.) side wall
// and the lifelines its own messages touch. Shared by every block type —
// there is no per-type wall calculation, so this constant is the single
// source of truth for that spacing (see BLOCK_WALL_MARGIN's use below for
// why a *second*, independent use of it also guards against an untouched
// lifeline).
const BLOCK_WALL_MARGIN = 4

// Effective width of a self-message's loop, including room for an
// autonumber badge drawn at the start of the top arm when active. The badge
// digits replace the leading dashes rather than adding a second arrowhead,
// so the loop only needs to widen by the badge's own digit count — one
// extra column per digit — to keep the corner glyphs (┐/┘) intact.
// Shared by the drawing pass, the canvas-width pass, and the block-wall
// extent calculation so all three agree on how much room a numbered
// self-message actually needs.
function selfLoopWidth(msg: Message): number {
  return msg.seqNumber === undefined
    ? SELF_LOOP_WIDTH
    : SELF_LOOP_WIDTH + String(msg.seqNumber).length
}

/**
 * Render a Mermaid sequence diagram to ASCII/Unicode text.
 *
 * Pipeline: parse → layout (columns + rows) → draw onto canvas → string.
 */
export function renderSequenceAscii(
  text: string,
  config: AsciiConfig,
  colorMode?: ColorMode,
  theme?: AsciiTheme,
): string {
  const lines = splitStatements(text)
  const diagram = parseSequenceDiagram(lines)

  if (diagram.actors.length === 0) return ''

  const useAscii = config.useAscii

  // Box-drawing characters
  const H = useAscii ? '-' : '─'
  const V = useAscii ? '|' : '│'
  const TL = useAscii ? '+' : '┌'
  const TR = useAscii ? '+' : '┐'
  const BL = useAscii ? '+' : '└'
  const BR = useAscii ? '+' : '┘'
  const JT = useAscii ? '+' : '┬' // top junction on lifeline
  const JB = useAscii ? '+' : '┴' // bottom junction on lifeline
  const JL = useAscii ? '+' : '├' // left junction
  const JR = useAscii ? '+' : '┤' // right junction

  // ---- LAYOUT: compute lifeline X positions ----

  const actorIdx = new Map<string, number>()
  diagram.actors.forEach((a, i) => actorIdx.set(a.id, i))

  /**
   * Look up an actor's column index. The parser's `ensureActor` (see
   * sequence/parser.ts) guarantees every message endpoint has a
   * corresponding actor entry, so this is always found for real parsed
   * input — but that guarantee lives in a different module/function, so
   * narrow it here explicitly rather than trusting it silently across the
   * boundary.
   */
  function actorIndexOf(id: string): number {
    const idx = actorIdx.get(id)
    if (idx === undefined) {
      /* v8 ignore next */
      throw new Error(`Sequence diagram: unknown actor "${id}"`)
    }
    return idx
  }

  /**
   * Widest line among a block's header ("alt [label]") and every divider
   * ("[else label]") — the minimum wall width the block's own text needs,
   * independent of how far its messages' lifelines happen to span.
   */
  function maxBlockLabelWidth(block: Block): number {
    const hdrLabel = block.label ? `${block.type} [${block.label}]` : block.type
    let width = maxLineWidth(hdrLabel)
    for (const divider of block.dividers) {
      if (divider.label) {
        width = Math.max(width, maxLineWidth(`[${divider.label}]`))
      }
    }
    return width
  }

  // Clamped: a negative boxBorderPadding would otherwise produce a negative
  // actor/note box width for a short label (see issue #343's CodeRabbit
  // review — the same class of bug fixed in draw-boxes.ts's
  // measureMultiBox/drawMultiBox for class/ER boxes).
  const boxPad = Math.max(0, config.boxBorderPadding)
  // `maxLineWidth`/`lineCount` account for the label only; add the
  // stick-figure glyph's own footprint (see ACTOR_GLYPH_LINES below) for
  // actor-kind participants so box sizing matches what drawActorBox draws.
  const actorContentWidth = (a: {
    label: string
    type: 'participant' | 'actor'
  }) =>
    Math.max(maxLineWidth(a.label), a.type === 'actor' ? ACTOR_GLYPH_WIDTH : 0)
  const actorContentHeight = (a: {
    label: string
    type: 'participant' | 'actor'
  }) => lineCount(a.label) + (a.type === 'actor' ? ACTOR_GLYPH_LINES.length : 0)
  // Use max line width for multi-line actor labels
  const actorBoxWidths = diagram.actors.map(
    (a) => actorContentWidth(a) + 2 * boxPad + 2,
  )
  const halfBox = actorBoxWidths.map((w) => Math.ceil(w / 2))
  // Calculate actor box heights based on number of lines in label
  const actorBoxHeights = diagram.actors.map((a) => actorContentHeight(a) + 2) // content lines + top/bottom border
  const actorBoxH = Math.max(...actorBoxHeights, 3) // Use max height for consistent lifeline positioning
  // Left border column of each actor's box — drawActorBox derives the same
  // `left` from the lifeline centre, so a creating arrow can stop just short
  // of it (see "DRAW: messages" below).
  const actorBoxLeft = (i: number, cx: number) =>
    cx - Math.floor(actorBoxWidths[i]! / 2)

  // ---- Participant lifecycle (create / destroy) ----
  //
  // A `create participant X` box is drawn centred on the row of the message
  // that creates it, in place of a header box; a `destroy X` lifeline stops
  // one row under the destroying arrow with a cross glyph, and gets no
  // footer box. Mermaid draws the created box centred on the message line
  // and ends the destroyed lifeline with a cross at that line; the ASCII
  // form keeps the arrowhead intact by putting the cross on the row below
  // — a cross *on* the arrow row would replace the arrowhead and read as a
  // lost message (`-x`) instead.
  //
  // Rows above the arrow taken by the created box, and rows below it. For
  // the default 3-row box that's one row each side of the arrow row.
  const createdBoxAbove = Math.floor((actorBoxH - 1) / 2)
  const createdBoxBelow = actorBoxH - 1 - createdBoxAbove
  // Message index → index of the actor it creates (recipient) / destroys.
  const createdByMsg = new Map<number, number>()
  const destroyedByMsg = new Map<number, number>()
  diagram.actors.forEach((a, i) => {
    if (a.createdAt !== undefined) createdByMsg.set(a.createdAt, i)
    if (a.destroyedAt !== undefined) destroyedByMsg.set(a.destroyedAt, i)
  })
  // Filled in by the vertical layout pass: actor index → top row of its
  // created box / row of its destroy cross.
  const createdBoxTop = new Map<number, number>()
  const destroyRow = new Map<number, number>()

  // ---- Participant groups (box … end) ----
  //
  // Each non-empty box becomes a labelled bracket around its members' header
  // boxes (and an unlabelled one around their footer boxes), one column
  // outside the outermost member's box on each side and one row above and
  // below the actor-box rows:
  //
  //   ┌─ Label ───────────────────┐
  //   │ ┌───────┐       ┌──────┐  │
  //   │ │ Alice │       │ John │  │
  //   │ └───┬───┘       └───┬──┘  │
  //   └─────┼───────────────┼─────┘
  //         │               │
  //
  // The bracket spans from the leftmost member to the rightmost, so a
  // participant declared between two members sits visually inside, as in
  // Mermaid. Colour is not representable here and is ignored. Running the
  // side walls the full height of the diagram (as Mermaid's background
  // rect does) would cut through every message crossing a group boundary,
  // so the group is shown at the header and footer only.
  const boxSpans = diagram.boxes
    .filter((b) => b.actorIds.length > 0)
    .map((b) => {
      const idxs = b.actorIds.map(actorIndexOf)
      return { label: b.label, lo: Math.min(...idxs), hi: Math.max(...idxs) }
    })
  const hasBoxes = boxSpans.length > 0
  // Actor index → index into boxSpans whose span contains it, or -1.
  const boxSpanOf = diagram.actors.map((_, i) =>
    boxSpans.findIndex((s) => s.lo <= i && i <= s.hi),
  )
  // Rows the header bracket adds above the actor boxes (its top border) —
  // the same count is added below them for its bottom border, and the
  // footer bracket mirrors both.
  const bracketRows = hasBoxes ? 1 : 0
  // Columns between a member box's border and the bracket wall.
  const BRACKET_GAP = 1
  // Minimum bracket width for a label: `┌─ Label ─┐` needs the corner, a
  // dash, a space, the label, a space, a dash, and the closing corner.
  const bracketLabelWidth = (label: string) =>
    label === '' ? 0 : maxLineWidth(label) + 6

  // Compute minimum gap between adjacent lifelines based on message labels.
  // For messages spanning multiple actors, distribute the required width across gaps.
  const adjMaxWidth: number[] = new Array(
    Math.max(diagram.actors.length - 1, 0),
  ).fill(0)

  for (const msg of diagram.messages) {
    const fi = actorIndexOf(msg.from)
    const ti = actorIndexOf(msg.to)
    if (fi === ti) continue // self-messages don't affect spacing
    const lo = Math.min(fi, ti)
    const hi = Math.max(fi, ti)
    // Required gap per span = (max line width + arrow decorations) / number of gaps
    const needed = maxLineWidth(msg.label) + 4
    const numGaps = hi - lo
    const perGap = Math.ceil(needed / numGaps)
    for (let g = lo; g < hi; g++) {
      adjMaxWidth[g] = Math.max(adjMaxWidth[g]!, perGap)
    }
  }

  // Compute lifeline x-positions (greedy left-to-right).
  // See paddingOffset's doc comment (types.ts) for why this is an offset
  // from the paddingX default rather than the raw config value.
  const minLifelineGap = paddingOffset(
    config.paddingX,
    DEFAULT_PADDING_X,
    10,
    4,
  )
  // A bracketed first participant needs room for the wall to its left; two
  // adjacent participants in different groups (or one grouped, one not)
  // need room for the wall(s) between their boxes, plus a blank column on
  // each side of every wall. Same-group neighbours have no wall between.
  const llX: number[] = [
    halfBox[0]! + (boxSpanOf[0] === -1 ? 0 : BRACKET_GAP + 1),
  ]
  for (let i = 1; i < diagram.actors.length; i++) {
    const prevSpan = boxSpanOf[i - 1]!
    const thisSpan = boxSpanOf[i]!
    const walls =
      prevSpan === thisSpan
        ? 0
        : (prevSpan === -1 ? 0 : 1) + (thisSpan === -1 ? 0 : 1)
    // The base constraint already leaves two blank columns between boxes;
    // each wall needs one column of its own plus one more blank beside it.
    const wallExtra = walls === 0 ? 0 : walls * (BRACKET_GAP + 1) - 1
    const gap = Math.max(
      halfBox[i - 1]! + halfBox[i]! + 2 + wallExtra,
      adjMaxWidth[i - 1]! + 2,
      minLifelineGap,
    )
    llX[i] = llX[i - 1]! + gap
  }

  // Bracket wall columns, from live lifeline positions (later passes only
  // ever shift lifelines right, so these stay valid if read at draw time).
  const bracketLeft = (span: { lo: number }) =>
    actorBoxLeft(span.lo, llX[span.lo]!) - BRACKET_GAP - 1
  const bracketRight = (span: { label: string; lo: number; hi: number }) =>
    Math.max(
      actorBoxLeft(span.hi, llX[span.hi]!) +
        actorBoxWidths[span.hi]! -
        1 +
        BRACKET_GAP +
        1,
      bracketLeft(span) + bracketLabelWidth(span.label) - 1,
    )

  // A label wider than its members' span widens the bracket to the right;
  // push everything after the group out of the way, the same way the block-
  // label pass below does for loop/alt headers.
  for (const span of boxSpans) {
    if (span.hi + 1 >= diagram.actors.length) continue
    const nextLeft = actorBoxLeft(span.hi + 1, llX[span.hi + 1]!)
    const nextWall = boxSpanOf[span.hi + 1] === -1 ? 0 : BRACKET_GAP + 1
    const needed = bracketRight(span) + BRACKET_GAP + 1 + nextWall
    const shift = needed - nextLeft
    if (shift > 0) {
      const shifted = llX.slice(span.hi + 1).map((x) => x + shift)
      llX.splice(span.hi + 1, shifted.length, ...shifted)
    }
  }

  // A block's wall only needs to reach as far right as the lifelines its
  // own messages touch (see the identical minLX/maxLX calc in the block
  // drawing pass below) — but the header/divider LABEL can need more room
  // than that. If an uninvolved participant's lifeline already sits at or
  // past that label-driven width, drawing the wall there lands on a
  // different column than the lifeline (which was already placed) and
  // just leaves that lifeline's "│" sitting inside the block, right next
  // to the block's own wall — visually indistinguishable from the block
  // enclosing a participant it has nothing to do with (#387, on top of
  // #352's original fix). Push every lifeline after the block's rightmost
  // participant out of the way before anything downstream depends on
  // these positions.
  //
  // This runs independently of, and before, the draw-time pull-back added
  // for #353 (below, in the "DRAW: blocks" pass): that pull-back only ever
  // shrinks a block's *natural* (message-driven) extent away from an
  // untouched lifeline it would otherwise land on — it has no notion of
  // the label-driven width computed here. Without this pass shifting the
  // lifeline out of the way first, a long label would push bRight straight
  // back past whatever #353's pull-back had just cleared, re-enclosing it.
  // This pass's own estimate below (naturalRight/labelRight, using
  // BLOCK_WALL_MARGIN unclamped by any pull-back) is always >= whatever
  // the draw-time pass can ultimately produce, so it shifts at least far
  // enough — never more precisely, but never insufficiently either.
  for (const block of diagram.blocks) {
    let loIdx = -1
    let hiIdx = -1
    let minLX = Number.POSITIVE_INFINITY
    let maxLX = -1
    for (let m = block.startIndex; m <= block.endIndex; m++) {
      if (m >= diagram.messages.length) break
      const msg = diagram.messages[m]!
      const f = actorIndexOf(msg.from)
      const t = actorIndexOf(msg.to)
      loIdx = loIdx === -1 ? Math.min(f, t) : Math.min(loIdx, f, t)
      hiIdx = Math.max(hiIdx, f, t)
      minLX = Math.min(minLX, llX[Math.min(f, t)]!)
      maxLX = Math.max(maxLX, llX[Math.max(f, t)]!)
      if (f === t) {
        const selfRight =
          llX[f]! + SELF_LOOP_WIDTH + 2 + maxLineWidth(msg.label)
        maxLX = Math.max(maxLX, selfRight)
      }
    }
    // An empty block, or one whose rightmost participant is already the
    // last actor, has nothing after it that could be swallowed.
    if (hiIdx === -1 || hiIdx + 1 >= diagram.actors.length) continue

    const bLeft = Math.max(0, minLX - BLOCK_WALL_MARGIN)
    const naturalRight = maxLX + BLOCK_WALL_MARGIN
    const labelRight = bLeft + 1 + maxBlockLabelWidth(block)
    const bRight = Math.max(naturalRight, labelRight)

    const nextLL = llX[hiIdx + 1]!
    const shift = bRight + 2 - nextLL
    if (shift > 0) {
      // Shift every lifeline from hiIdx+1 onward by `shift`, in place —
      // llX's identity has to survive this pass (later blocks in this same
      // loop, and everything downstream, read positions back out of it) so
      // this can't rebuild the array under a new binding. Deriving the
      // shifted values with .map() and writing them back via splice (same
      // start/length, so it's a pure overwrite) avoids the index-reassignment
      // loop without changing what ends up in llX.
      const shifted = llX.slice(hiIdx + 1).map((x) => x + shift)
      llX.splice(hiIdx + 1, shifted.length, ...shifted)
    }
  }

  // ---- LAYOUT: compute vertical positions for messages ----

  // For each message index, track the y where its arrow is drawn.
  // Also track block start/end y positions and divider y positions.
  const msgArrowY: number[] = []
  const msgLabelY: number[] = []
  const blockStartY = new Map<number, number>()
  const blockEndY = new Map<number, number>()
  const divYMap = new Map<string, number>() // "blockIdx:divIdx" → y
  const notePositions: Array<{
    x: number
    y: number
    width: number
    height: number
    lines: string[]
  }> = []

  // Start right below the header boxes — and below the group bracket's
  // bottom border when there is one (its top border row sits above them).
  const headerBoxTop = bracketRows
  const headerBottom = headerBoxTop + actorBoxH // first row after the boxes
  let curY = headerBottom + bracketRows

  // rowGap: the blank rows around messages, notes, and blocks. See
  // paddingOffset's doc comment (types.ts) for why this is an offset from
  // the paddingY default rather than the raw config value. Floored at 0 (not
  // 1) since these are single-row gaps, not a whole box — collapsing a gap
  // to 0 rows is still a valid, readable layout, just a tight one.
  const rowGap = paddingOffset(config.paddingY, DEFAULT_PADDING_Y, 1, 0)

  // Below rowGap's own floor of 0, three specific gaps still need at least
  // one row: the row right after a divider (or the message row drawn there
  // would land on the divider's own row and overwrite it), the row right
  // after a block's closing border (same reasoning against whatever comes
  // next), and the row before the footer (the footer's top border is drawn
  // *before* messages/arrows in the draw pass — see "DRAW: actor header +
  // footer boxes" below — so a message landing on the same row as the
  // footer would draw its arrow through the footer's border). Everywhere
  // else (blank row before a message, gap before a note, blank row before a
  // block header) is genuinely optional spacing with no such collision risk,
  // so those keep using rowGap directly. See issue #343's CodeRabbit review.
  const minSeparatorGap = Math.max(rowGap, 1)

  // Pre-message notes: afterIndex === -1 — position before message loop
  for (const note of diagram.notes) {
    if (note.afterIndex !== -1) continue
    curY += rowGap // gap before note
    const nLines = splitLines(note.text)
    const nWidth =
      Math.max(...nLines.map((l) => displayWidth(l))) + 2 + 2 * boxPad
    const nHeight = nLines.length + 2

    const aIdx = actorIdx.get(note.actorIds[0]!) ?? 0
    let nx: number
    if (note.position === 'left') {
      nx = llX[aIdx]! - nWidth - 1
    } else if (note.position === 'right') {
      nx = llX[aIdx]! + 2
    } else {
      // 'over'
      if (note.actorIds.length >= 2) {
        const aIdx2 = actorIdx.get(note.actorIds[1]!) ?? aIdx
        nx = Math.floor((llX[aIdx]! + llX[aIdx2]!) / 2) - Math.floor(nWidth / 2)
      } else {
        nx = llX[aIdx]! - Math.floor(nWidth / 2)
      }
    }
    nx = Math.max(0, nx)

    notePositions.push({
      x: nx,
      y: curY,
      width: nWidth,
      height: nHeight,
      lines: nLines,
    })
    curY += nHeight
  }

  for (let m = 0; m < diagram.messages.length; m++) {
    // Block openings at this message
    for (let b = 0; b < diagram.blocks.length; b++) {
      if (diagram.blocks[b]!.startIndex === m) {
        curY += rowGap + 1 // blank rows + 1 fixed header row
        blockStartY.set(b, curY - 1)
      }
    }

    // Dividers at this message index
    for (let b = 0; b < diagram.blocks.length; b++) {
      for (let d = 0; d < diagram.blocks[b]!.dividers.length; d++) {
        if (diagram.blocks[b]!.dividers[d]!.index === m) {
          curY += rowGap
          divYMap.set(`${b}:${d}`, curY)
          curY += minSeparatorGap
        }
      }
    }

    curY += rowGap // blank row before message

    const msg = diagram.messages[m]!
    const isSelf = msg.from === msg.to

    // Calculate height needed for multi-line message labels
    const msgLineCount = lineCount(msg.label)

    // A self-message can't sensibly create its own recipient (the loop
    // glyphs would sit where the box goes), so that degenerate case keeps
    // the header box instead.
    const createdIdx = isSelf ? undefined : createdByMsg.get(m)
    const destroyedIdx = destroyedByMsg.get(m)

    if (isSelf) {
      // Self-message occupies 3+ rows: top-arm, label-col(s), bottom-arm
      msgLabelY[m] = curY + 1
      msgArrowY[m] = curY
      curY += 2 + msgLineCount // top-arm + label lines + bottom-arm
    } else {
      // Normal message: label row(s), then — for a creating message — the
      // rows of the created box above the arrow, then the arrow row, then
      // the created box's rows below it.
      const boxAbove = createdIdx === undefined ? 0 : createdBoxAbove
      const boxBelow = createdIdx === undefined ? 0 : createdBoxBelow
      msgLabelY[m] = curY
      msgArrowY[m] = curY + msgLineCount + boxAbove
      curY += msgLineCount + boxAbove + 1 + boxBelow
      if (createdIdx !== undefined) {
        createdBoxTop.set(createdIdx, msgArrowY[m]! - boxAbove)
      }
    }

    // One reserved row under the arrow (under the bottom arm, for a
    // self-message) for the destroy cross, so it never lands on whatever
    // comes next when rowGap is 0.
    if (destroyedIdx !== undefined) {
      destroyRow.set(destroyedIdx, curY)
      curY += 1
    }

    // Notes after this message
    for (let n = 0; n < diagram.notes.length; n++) {
      if (diagram.notes[n]!.afterIndex === m) {
        curY += rowGap
        const note = diagram.notes[n]!
        const nLines = splitLines(note.text)
        const nWidth =
          Math.max(...nLines.map((l) => displayWidth(l))) + 2 + 2 * boxPad
        const nHeight = nLines.length + 2

        // Determine x position based on note.position
        const aIdx = actorIdx.get(note.actorIds[0]!) ?? 0
        let nx: number
        if (note.position === 'left') {
          nx = llX[aIdx]! - nWidth - 1
        } else if (note.position === 'right') {
          nx = llX[aIdx]! + 2
        } else {
          // 'over' — center over actor(s)
          if (note.actorIds.length >= 2) {
            const aIdx2 = actorIdx.get(note.actorIds[1]!) ?? aIdx
            nx =
              Math.floor((llX[aIdx]! + llX[aIdx2]!) / 2) -
              Math.floor(nWidth / 2)
          } else {
            nx = llX[aIdx]! - Math.floor(nWidth / 2)
          }
        }
        nx = Math.max(0, nx)

        notePositions.push({
          x: nx,
          y: curY,
          width: nWidth,
          height: nHeight,
          lines: nLines,
        })
        curY += nHeight
      }
    }

    // Block closings after this message
    for (let b = 0; b < diagram.blocks.length; b++) {
      if (diagram.blocks[b]!.endIndex === m) {
        curY += rowGap
        blockEndY.set(b, curY)
        curY += minSeparatorGap
      }
    }
  }

  curY += minSeparatorGap // gap before footer (mandatory — see minSeparatorGap)
  // With brackets, footerY is the footer bracket's top border row and the
  // footer boxes start one row under it; otherwise it is the boxes' own top.
  const footerY = curY
  const footerBoxTop = footerY + bracketRows
  const totalH = footerBoxTop + actorBoxH + bracketRows

  // Total canvas width
  const lastLL = llX[llX.length - 1] ?? 0
  const lastHalf = halfBox[halfBox.length - 1] ?? 0
  let totalW = lastLL + lastHalf + 2
  for (const span of boxSpans) {
    totalW = Math.max(totalW, bracketRight(span) + 2)
  }

  // Ensure canvas is wide enough for self-message labels and notes
  for (let m = 0; m < diagram.messages.length; m++) {
    const msg = diagram.messages[m]!
    if (msg.from === msg.to) {
      const fi = actorIndexOf(msg.from)
      const selfRight =
        llX[fi]! + selfLoopWidth(msg) + 2 + 2 + maxLineWidth(msg.label)
      totalW = Math.max(totalW, selfRight + 1)
    }
  }
  for (const np of notePositions) {
    totalW = Math.max(totalW, np.x + np.width + 1)
  }

  const canvas = mkCanvas(totalW, totalH - 1)
  const rc = mkRoleCanvas(totalW, totalH - 1)

  /** Set a character on the canvas and track its role. */
  function setC(x: number, y: number, ch: string, role: CharRole): void {
    write(canvas, x, y, ch, { role, roleCanvas: rc })
  }

  /**
   * Write a line of text starting at grid cell (x, y), one grid cell per
   * terminal column rather than one grid cell per JS code point.
   *
   * A CJK/kana/hangul/fullwidth-form/emoji grapheme renders as TWO terminal
   * columns but is a single JS character — writing it into a single grid
   * cell (as a naive `for (let i = 0; i < line.length; i++)` loop does)
   * under-reserves a column for every wide character, so unrelated content
   * (box borders, adjacent lifelines) drawn later at a fixed grid index no
   * longer lines up with what a real terminal actually renders for this
   * row (issue #334). `toDisplayCells` (display-width.ts) splits `text`
   * into one entry per terminal column — a wide grapheme followed by an
   * empty placeholder entry — so writing one cell per entry keeps this
   * row's grid indices in step with its rendered terminal columns, the
   * same approach `drawText` (canvas.ts) already uses for flowchart/class/
   * ER diagram boxes.
   *
   * `exclusiveMaxX`, when given, additionally skips any cell at or past
   * that grid index — matching call sites that previously bounded their
   * own manual write loop with `x < totalW` (a one-column margin short of
   * `setC`'s own canvas-edge clipping). `setC` still clips to the actual
   * canvas bounds regardless, so omitting it just falls back to that.
   */
  function writeTextCells(
    x: number,
    y: number,
    text: string,
    role: CharRole,
    exclusiveMaxX?: number,
  ): void {
    const cells = toDisplayCells(text)
    for (let i = 0; i < cells.length; i++) {
      const cx = x + i
      if (exclusiveMaxX !== undefined && cx >= exclusiveMaxX) break
      // A wide grapheme's glyph cell is always immediately followed by its
      // placeholder cell (toDisplayCells' pairing). Writing the glyph
      // without room for that placeholder would leave its second terminal
      // column unreserved even though the glyph still renders across two
      // columns — reintroducing this file's own under-reservation bug
      // right at the clip boundary instead of over the whole string. Stop
      // one cell earlier instead of splitting the pair.
      const isWideGlyphStart = cells[i + 1] === WIDE_CHAR_PLACEHOLDER
      if (
        isWideGlyphStart &&
        exclusiveMaxX !== undefined &&
        cx + 1 >= exclusiveMaxX
      ) {
        break
      }
      setC(cx, y, cells[i]!, role)
    }
  }

  // ---- DRAW: helper to place a bordered actor box (supports multi-line labels) ----

  /**
   * Draws a bordered, centered actor box directly onto the shared sequence
   * canvas. This intentionally does NOT go through the shared `drawMultiBox`
   * primitive (src/ascii/draw-boxes.ts), for two concrete reasons:
   *
   * 1. Coordinate system: `drawMultiBox` returns a standalone canvas rooted
   *    at (0, 0), meant to be measured and then copied onto a caller's
   *    canvas (as class-diagram.ts and er-diagram.ts do). Actor boxes are
   *    positioned by a lifeline's center x-coordinate (`cx`), and are drawn
   *    twice per actor (header at y=0, footer at y=footerY) directly via the
   *    closure-captured `setC`, alongside unrelated lifeline/junction
   *    drawing that shares the same canvas and role-tracking.
   * 2. Sizing/alignment semantics differ, not just coordinates: `drawMultiBox`
   *    sizes each section by raw `.length` and left-aligns its content with
   *    fixed padding. Actor labels are centered and sized via
   *    `maxLineWidth` (multiline-utils.ts), which is deliberately
   *    display-width-aware (not `.length`) so wide CJK/emoji labels get a
   *    correctly-sized box. Routing actor boxes through `drawMultiBox` as it
   *    stands would silently narrow boxes for wide-character actor labels —
   *    reintroducing the exact bug `maxLineWidth` exists to avoid — and
   *    changing `drawMultiBox` itself to be display-width-aware and
   *    center-aligned would alter class/ER diagram box sizing, which must
   *    stay untouched.
   *
   * For an `actor`-kind participant, `ACTOR_GLYPH_LINES` (a small stick
   * figure) is prepended to the label lines, inside the same box — the
   * box's width/height precompute above (`actorContentWidth`/
   * `actorContentHeight`) already reserves room for it so this stays a
   * pure drawing step with no additional sizing math.
   *
   * `boxH` is always the diagram-wide `actorBoxH` (the tallest box among
   * *all* actors), not this actor's own content height — every box must
   * bottom out at the same row so the lifeline/junction drawn below it
   * (which unconditionally starts at row `actorBoxH`, see the "DRAW:
   * lifelines" section below) connects directly to the box's bottom
   * border instead of leaving a gap. A participant box shorter than an
   * adjacent actor's stick-figure box gets blank rows appended above its
   * bottom border to make up the difference.
   */
  function drawActorBox(
    cx: number,
    topY: number,
    label: string,
    actorType: 'participant' | 'actor',
    boxH: number,
  ): void {
    const glyphLines = actorType === 'actor' ? ACTOR_GLYPH_LINES : []
    const lines = [...glyphLines, ...splitLines(label)]
    const maxW = Math.max(
      maxLineWidth(label),
      glyphLines.length > 0 ? ACTOR_GLYPH_WIDTH : 0,
    )
    const w = maxW + 2 * boxPad + 2
    const h = boxH
    const contentRows = h - 2
    const left = cx - Math.floor(w / 2)

    // Top border
    setC(left, topY, TL, 'border')
    for (let x = 1; x < w - 1; x++) setC(left + x, topY, H, 'border')
    setC(left + w - 1, topY, TR, 'border')

    // Content rows (top-aligned; horizontally centered). Any rows beyond
    // `lines.length` (up to `contentRows`) stay blank padding — see the
    // `boxH` doc note above.
    for (let i = 0; i < contentRows; i++) {
      const row = topY + 1 + i
      setC(left, row, V, 'border')
      setC(left + w - 1, row, V, 'border')
      const line = lines[i]
      if (line === undefined) continue
      // Center this line within the box. Centering offset and cell-writing
      // both use display width (terminal columns), not `.length` (JS
      // code units) — a code-unit-based offset would under-center CJK
      // labels, and writing one grid cell per code unit (rather than per
      // terminal column) would under-reserve columns for wide glyphs,
      // both contributing to issue #334's border/content misalignment.
      const ls = left + 1 + boxPad + Math.floor((maxW - displayWidth(line)) / 2)
      writeTextCells(ls, row, line, 'text')
    }

    // Bottom border
    const bottomY = topY + h - 1
    setC(left, bottomY, BL, 'border')
    for (let x = 1; x < w - 1; x++) setC(left + x, bottomY, H, 'border')
    setC(left + w - 1, bottomY, BR, 'border')
  }

  // ---- DRAW: lifelines ----

  // A created participant's lifeline starts under its mid-diagram box; a
  // destroyed one's ends at its cross row (drawn in the messages pass, so
  // the cross wins over the `│` painted here).
  const lifelineTop = (i: number) => {
    const boxTop = createdBoxTop.get(i)
    return boxTop === undefined ? headerBottom : boxTop + actorBoxH
  }
  const lifelineBottom = (i: number) => destroyRow.get(i) ?? footerY

  for (let i = 0; i < diagram.actors.length; i++) {
    const x = llX[i]!
    for (let y = lifelineTop(i); y <= lifelineBottom(i); y++) {
      setC(x, y, V, 'line')
    }
  }

  // ---- DRAW: participant-group brackets (box … end) ----

  const CROSS = useAscii ? '+' : '┼'
  /**
   * One bracket: top border (with the label, if any), side walls down the
   * actor-box rows, bottom border. Lifelines that pass through a border row
   * get a crossing glyph; a created (header) or destroyed (footer) member's
   * lifeline doesn't reach that row, so its column keeps the plain border.
   */
  function drawBracket(
    span: { label: string; lo: number; hi: number },
    topRow: number,
    label: string,
  ): void {
    const left = bracketLeft(span)
    const right = bracketRight(span)
    const bottomRow = topRow + actorBoxH + 1
    setC(left, topRow, TL, 'border')
    setC(right, topRow, TR, 'border')
    setC(left, bottomRow, BL, 'border')
    setC(right, bottomRow, BR, 'border')
    for (let x = left + 1; x < right; x++) {
      setC(x, topRow, H, 'border')
      setC(x, bottomRow, H, 'border')
    }
    for (let y = topRow + 1; y < bottomRow; y++) {
      setC(left, y, V, 'border')
      setC(right, y, V, 'border')
    }
    if (label !== '') {
      // `┌─ Label ─…`: keep the first dash, then the label with a space on
      // each side. Multi-line labels take the first line only — the border
      // is a single row.
      writeTextCells(left + 2, topRow, ` ${splitLines(label)[0]!} `, 'text')
    }
    for (let i = span.lo; i <= span.hi; i++) {
      const x = llX[i]!
      if (lifelineTop(i) <= topRow && topRow <= lifelineBottom(i)) {
        setC(x, topRow, CROSS, 'junction')
      }
      if (lifelineTop(i) <= bottomRow && bottomRow <= lifelineBottom(i)) {
        setC(x, bottomRow, CROSS, 'junction')
      }
    }
  }
  for (const span of boxSpans) {
    drawBracket(span, 0, span.label)
    drawBracket(span, footerY, '')
  }

  // ---- DRAW: actor header + footer boxes (drawn over lifelines) ----

  for (let i = 0; i < diagram.actors.length; i++) {
    const actor = diagram.actors[i]!
    // Created: the box sits on its creating message's row, not in the
    // header. Destroyed: no footer box — the lifeline already ended.
    const headerTop = createdBoxTop.get(i) ?? headerBoxTop
    const destroyed = destroyRow.has(i)
    drawActorBox(llX[i]!, headerTop, actor.label, actor.type, actorBoxH)
    if (!destroyed) {
      drawActorBox(llX[i]!, footerBoxTop, actor.label, actor.type, actorBoxH)
    }

    // Lifeline junctions on box borders (Unicode only)
    if (!useAscii) {
      setC(llX[i]!, headerTop + actorBoxH - 1, JT, 'junction')
      if (!destroyed) setC(llX[i]!, footerBoxTop, JB, 'junction')
    }
  }

  // ---- DRAW: messages ----

  for (let m = 0; m < diagram.messages.length; m++) {
    const msg = diagram.messages[m]!
    const fi = actorIndexOf(msg.from)
    const ti = actorIndexOf(msg.to)
    const fromX = llX[fi]!
    const toX = llX[ti]!
    const isSelf = fi === ti
    const isDashed = msg.lineStyle === 'dashed'
    const isFilled = msg.arrowHead === 'filled'
    // "lost message" (-x/--x): a distinct cross terminator, not the plain
    // filled arrowhead it otherwise shares with ->>/-->>. Direction-
    // independent, unlike the arrow glyphs below — see issue #330.
    const isLost = msg.isLost === true
    const lostChar = useAscii ? 'x' : '✕'

    // Arrow line character (solid vs dashed)
    const lineChar = isDashed ? (useAscii ? '.' : '╌') : H

    if (isSelf) {
      // Self-message: 3-row loop to the right of the lifeline
      //   ├──┐           (row 0 = msgArrowY)
      //   │  │ Label     (row 1)
      //   │◄─┘           (row 2)
      //
      // The loop is only SELF_LOOP_WIDTH (4) columns wide by default, with no
      // spare room for a second arrowhead without corrupting the loop's
      // corner glyphs — so a bidirectional self-message still parses and
      // draws a single arrowhead only. An autonumbered self-message widens
      // the loop (see selfLoopWidth) so the badge digits fit at the start
      // of the top arm without touching the corner.
      const y0 = msgArrowY[m]!
      const loopW = selfLoopWidth(msg)
      const numStr =
        msg.seqNumber === undefined ? undefined : String(msg.seqNumber)
      // Split the label on <br/>-normalized newlines so multi-line self-arrow
      // labels get one row each instead of dumping a literal \n mid-row.
      const msgLines = splitLines(msg.label)

      // Row 0: start junction + [autonumber badge] + horizontal + top-right
      // corner. The badge, when present, replaces the leading dashes rather
      // than sitting alongside them — mirroring how the normal-message
      // badge overwrites the start of its arrow line.
      setC(fromX, y0, JL, 'junction')
      let dashStart = fromX + 1
      if (numStr !== undefined) {
        for (let i = 0; i < numStr.length; i++)
          setC(fromX + 1 + i, y0, numStr[i]!, 'text')
        dashStart = fromX + 1 + numStr.length
      }
      for (let x = dashStart; x < fromX + loopW; x++)
        setC(x, y0, lineChar, 'line')
      setC(fromX + loopW, y0, useAscii ? '+' : '┐', 'corner')

      // Label rows: vertical on right side + one line of label text each
      const labelX = fromX + loopW + 2
      for (let lineIdx = 0; lineIdx < msgLines.length; lineIdx++) {
        const rowY = y0 + 1 + lineIdx
        setC(fromX + loopW, rowY, V, 'line')
        writeTextCells(labelX, rowY, msgLines[lineIdx]!, 'text', totalW)
      }

      // Bottom row: arrow-back + horizontal + bottom-right corner
      const bottomY = y0 + 1 + msgLines.length
      const arrowChar = isLost
        ? lostChar
        : isFilled
          ? useAscii
            ? '<'
            : '◀'
          : useAscii
            ? '<'
            : '◁'
      setC(fromX, bottomY, arrowChar, 'arrow')
      for (let x = fromX + 1; x < fromX + loopW; x++)
        setC(x, bottomY, lineChar, 'line')
      setC(fromX + loopW, bottomY, useAscii ? '+' : '┘', 'corner')
    } else {
      // Normal message: label on row above, arrow on row below
      const labelY = msgLabelY[m]!
      const arrowY = msgArrowY[m]!
      const leftToRight = fromX < toX

      // A creating message's arrow stops at the created box's near border
      // instead of the lifeline centre (the box occupies this row — see the
      // lifecycle comment near createdBoxAbove). `headX` is where the
      // arrowhead goes; the line runs from the sender up to it.
      const createsRecipient = createdByMsg.get(m) === ti
      let headX = toX
      if (createsRecipient) {
        const boxLeft = actorBoxLeft(ti, toX)
        const boxRight = boxLeft + actorBoxWidths[ti]! - 1
        headX = leftToRight ? boxLeft - 1 : boxRight + 1
      }

      // Draw label centered between the two lifelines (supports multi-line)
      const midX = Math.floor((fromX + toX) / 2)
      const msgLines = splitLines(msg.label)

      for (let lineIdx = 0; lineIdx < msgLines.length; lineIdx++) {
        const line = msgLines[lineIdx]!
        // Center on display width, not `.length` — see writeTextCells' doc
        // comment for why a code-unit-based offset under-centers CJK labels.
        const labelStart = midX - Math.floor(displayWidth(line) / 2)
        const y = labelY + lineIdx
        writeTextCells(labelStart, y, line, 'text', totalW)
      }

      // Draw arrow line
      if (leftToRight) {
        for (let x = fromX + 1; x < headX; x++)
          setC(x, arrowY, lineChar, 'line')
        // Arrowhead at destination
        const ah = isLost
          ? lostChar
          : isFilled
            ? useAscii
              ? '>'
              : '▶'
            : useAscii
              ? '>'
              : '▷'
        setC(headX, arrowY, ah, 'arrow')
        // Bidirectional (`<<->>` / `<<-->>`): mirror the arrowhead at the
        // departure end too. Both bidirectional tokens end in ">>" (see
        // parser.ts), so isFilled is always true here — no open-head
        // variant to branch on, unlike the one-way `ah` glyph above.
        if (msg.bidirectional) {
          const ahStart = useAscii ? '<' : '◀'
          setC(fromX, arrowY, ahStart, 'arrow')
        }
      } else {
        for (let x = headX + 1; x < fromX; x++)
          setC(x, arrowY, lineChar, 'line')
        const ah = isLost
          ? lostChar
          : isFilled
            ? useAscii
              ? '<'
              : '◀'
            : useAscii
              ? '<'
              : '◁'
        setC(headX, arrowY, ah, 'arrow')
        if (msg.bidirectional) {
          const ahStart = useAscii ? '>' : '▶'
          setC(fromX, arrowY, ahStart, 'arrow')
        }
      }

      // autonumber badge: overwrite the start of the arrow line with the
      // sequence number, mirroring the small circled number the SVG
      // renderer draws over the start of the arrow (see renderer.ts's
      // renderSeqNumberBadge). Skipped if it wouldn't fit before the
      // opposite arrowhead — the minimum lifeline gap (10 cols) comfortably
      // fits typical 1-3 digit sequence numbers alongside short labels.
      if (msg.seqNumber !== undefined) {
        const numStr = String(msg.seqNumber)
        if (leftToRight) {
          const start = fromX + 1
          if (start + numStr.length < toX) {
            for (let i = 0; i < numStr.length; i++)
              setC(start + i, arrowY, numStr[i]!, 'text')
          }
        } else {
          const start = fromX - numStr.length
          if (start > headX) {
            for (let i = 0; i < numStr.length; i++)
              setC(start + i, arrowY, numStr[i]!, 'text')
          }
        }
      }
    }
  }

  // ---- DRAW: destroy crosses ----

  // Same glyph as a lost message's terminator, on the destroyed actor's
  // lifeline one row under the destroying arrow (see the lifecycle comment
  // near createdBoxAbove for why not on the arrow row itself).
  for (const [i, y] of destroyRow) {
    setC(llX[i]!, y, useAscii ? 'x' : '✕', 'arrow')
  }

  // ---- DRAW: blocks (loop, alt, opt, par, etc.) ----

  // Largest column index it's currently safe to write a block wall into.
  // Starts at the canvas's own right margin (mirrors the historical
  // `totalW - 1` clamp) and is pushed out via increaseSize/
  // increaseRoleCanvasSize below whenever a wall needs to grow past it.
  let blockCanvasMaxX = totalW - 1

  for (let b = 0; b < diagram.blocks.length; b++) {
    const block = diagram.blocks[b]!
    const topY = blockStartY.get(b)
    const botY = blockEndY.get(b)
    if (topY === undefined || botY === undefined) continue

    // Find the leftmost/rightmost lifelines involved in this block's messages
    let minLX = totalW
    let maxLX = 0
    for (let m = block.startIndex; m <= block.endIndex; m++) {
      if (m >= diagram.messages.length) break
      const msg = diagram.messages[m]!
      const f = actorIdx.get(msg.from) ?? 0
      const t = actorIdx.get(msg.to) ?? 0
      minLX = Math.min(minLX, llX[Math.min(f, t)]!)
      maxLX = Math.max(maxLX, llX[Math.max(f, t)]!)
      // Self-arrows draw their loop glyphs (├──┐ … ◀──┘) and label further
      // right than the lifeline itself — account for that extent too, or a
      // long self-arrow label gets clipped by / drawn outside the wall.
      if (f === t) {
        const selfRight =
          llX[f]! + selfLoopWidth(msg) + 2 + maxLineWidth(msg.label)
        maxLX = Math.max(maxLX, selfRight)
      }
    }

    let bLeft = minLX - BLOCK_WALL_MARGIN
    let bRight = maxLX + BLOCK_WALL_MARGIN

    // minLX/maxLX (and therefore bLeft/bRight) only account for lifelines
    // *this block's own messages* touch. That leaves a gap: the fixed
    // margin above can coincidentally place a wall exactly on — or past —
    // a different, untouched lifeline's column (#353).
    //
    // The fix is to PULL the wall back short of that lifeline, not push it
    // past. Verified against real mermaid.js's own SVG output for this
    // exact diagram (see scripts/lib/real-mermaid.ts, the same engine
    // behind GitHub's own mermaid preview): `loop`/`opt` enclose `Database`
    // there because their own messages touch it directly, but `alt` —
    // which never messages `Database` — stops well short of it (124px of
    // real clearance, not a few px of overshoot), even though `loop`/`opt`
    // in the same diagram extend ~11px *past* Database's lifeline to
    // enclose it. Real mermaid never widens a block's wall to enclose a
    // lifeline its own messages don't touch; it only ever clears one it
    // was already going to reach. Applies to every block type alike, both
    // walls.
    let nextRightLL = Number.POSITIVE_INFINITY
    let nextLeftLL = Number.NEGATIVE_INFINITY
    for (const x of llX) {
      if (x > maxLX && x < nextRightLL) nextRightLL = x
      if (x < minLX && x > nextLeftLL) nextLeftLL = x
    }
    // Never pull back past maxLX/minLX themselves — those already include
    // the self-arrow extent computed above, and an untouched lifeline
    // sitting close enough behind one can otherwise pull bRight below the
    // self-arrow's own label, which the later block-border draw then
    // overwrites (the label silently loses characters — CodeRabbit caught
    // this on this exact fix). Clearing the untouched lifeline yields to
    // not clipping this block's own content when the two can't both fit.
    if (bRight >= nextRightLL)
      bRight = Math.max(maxLX, nextRightLL - BLOCK_WALL_MARGIN)
    if (bLeft <= nextLeftLL)
      bLeft = Math.min(minLX, nextLeftLL + BLOCK_WALL_MARGIN)

    bLeft = Math.max(0, bLeft)
    if (bRight > blockCanvasMaxX) {
      increaseSize(canvas, bRight + 1, totalH - 1)
      increaseRoleCanvasSize(rc, bRight + 1, totalH - 1)
      blockCanvasMaxX = bRight
    }

    // Header ("alt [label]") and divider ("[else label]") text is drawn
    // starting at bLeft + 1 (see below), clipped to whatever bRight the
    // pull-back above produced. A wall sized purely from message spans
    // (even after that untouched-lifeline pull-back) has no relationship
    // to label length, so a long condition label was silently cut off
    // mid-word instead of the block widening to fit it (#352). Measure the
    // longest label among the header and every divider up front and widen
    // the wall — and the canvas itself, if the extra room isn't already
    // there — to fit it before any drawing happens.
    //
    // `bLeft` here MUST be the fully-resolved value above (post pull-back,
    // post clamp) — computing `neededRight` from an intermediate bLeft
    // would silently under-widen whenever minLX/the pull-back puts bLeft
    // below its margin (this repo's own #352 repro hits exactly that case:
    // `A` is actor 0, so minLX - BLOCK_WALL_MARGIN is negative and bLeft
    // only becomes 0 via the clamp above). Any participant this widening
    // would otherwise swallow was already pushed further right by the
    // lifeline-shifting layout pass earlier in this function, so growing
    // bRight here doesn't re-collide with whatever the pull-back above
    // just cleared.
    const hdrLabel = block.label ? `${block.type} [${block.label}]` : block.type
    const neededRight = bLeft + 1 + maxBlockLabelWidth(block)
    if (neededRight > bRight) {
      bRight = neededRight
      const [canvasMaxX] = getCanvasSize(canvas)
      if (bRight > canvasMaxX) {
        increaseSize(canvas, bRight, totalH - 1)
        increaseRoleCanvasSize(rc, bRight, totalH - 1)
      }
      totalW = Math.max(totalW, bRight + 1)
      blockCanvasMaxX = Math.max(blockCanvasMaxX, bRight)
    }

    // Top border with block type label
    setC(bLeft, topY, TL, 'border')
    for (let x = bLeft + 1; x < bRight; x++) setC(x, topY, H, 'border')
    setC(bRight, topY, TR, 'border')
    // Write block header label over the top border (supports multi-line)
    const hdrLines = splitLines(hdrLabel)

    for (
      let lineIdx = 0;
      lineIdx < hdrLines.length && topY + lineIdx < botY;
      lineIdx++
    ) {
      writeTextCells(
        bLeft + 1,
        topY + lineIdx,
        hdrLines[lineIdx]!,
        'text',
        bRight,
      )
    }

    // Bottom border
    setC(bLeft, botY, BL, 'border')
    for (let x = bLeft + 1; x < bRight; x++) setC(x, botY, H, 'border')
    setC(bRight, botY, BR, 'border')

    // Side borders
    for (let y = topY + 1; y < botY; y++) {
      setC(bLeft, y, V, 'border')
      setC(bRight, y, V, 'border')
    }

    // Dividers
    for (let d = 0; d < block.dividers.length; d++) {
      const dY = divYMap.get(`${b}:${d}`)
      if (dY === undefined) continue
      const dashChar = isDashedH()
      setC(bLeft, dY, JL, 'junction')
      for (let x = bLeft + 1; x < bRight; x++) setC(x, dY, dashChar, 'line')
      setC(bRight, dY, JR, 'junction')
      // Divider label
      const dLabel = block.dividers[d]!.label
      if (dLabel) {
        const dStr = `[${dLabel}]`
        writeTextCells(bLeft + 1, dY, dStr, 'text', bRight)
      }
    }
  }

  // ---- DRAW: notes ----

  for (const np of notePositions) {
    // Ensure canvas is big enough
    increaseSize(canvas, np.x + np.width, np.y + np.height)
    increaseRoleCanvasSize(rc, np.x + np.width, np.y + np.height)
    // Top border
    setC(np.x, np.y, TL, 'border')
    for (let x = 1; x < np.width - 1; x++) setC(np.x + x, np.y, H, 'border')
    setC(np.x + np.width - 1, np.y, TR, 'border')
    // Content rows
    for (let l = 0; l < np.lines.length; l++) {
      const ly = np.y + 1 + l
      setC(np.x, ly, V, 'border')
      setC(np.x + np.width - 1, ly, V, 'border')
      // Blank the full interior (content + padding columns) first — the
      // note is drawn over lifelines that were already painted down every
      // row in this span, and writeTextCells below only touches the exact
      // cells the text occupies. Whenever a note's computed width happens
      // to put its own padding column on top of a lifeline's x position
      // (e.g. "Note over A,B" wide enough to reach B's lifeline), that
      // untouched padding column lets the stale lifeline character leak
      // through as a doubled border glyph right next to the note's own
      // border.
      for (let x = np.x + 1; x < np.x + np.width - 1; x++) {
        setC(x, ly, ' ', 'text')
      }
      writeTextCells(np.x + 1 + boxPad, ly, np.lines[l]!, 'text')
    }
    // Bottom border
    const by = np.y + np.height - 1
    setC(np.x, by, BL, 'border')
    for (let x = 1; x < np.width - 1; x++) setC(np.x + x, by, H, 'border')
    setC(np.x + np.width - 1, by, BR, 'border')
  }

  return canvasToString(canvas, { roleCanvas: rc, colorMode, theme })

  // ---- Helper: dashed horizontal character ----
  function isDashedH(): string {
    return useAscii ? '-' : '╌'
  }
}
