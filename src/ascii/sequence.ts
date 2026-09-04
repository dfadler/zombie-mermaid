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
  // Use max line width for multi-line actor labels
  const actorBoxWidths = diagram.actors.map(
    (a) => maxLineWidth(a.label) + 2 * boxPad + 2,
  )
  const halfBox = actorBoxWidths.map((w) => Math.ceil(w / 2))
  // Calculate actor box heights based on number of lines in label
  const actorBoxHeights = diagram.actors.map((a) => lineCount(a.label) + 2) // lines + top/bottom border
  const actorBoxH = Math.max(...actorBoxHeights, 3) // Use max height for consistent lifeline positioning

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
  const llX: number[] = [halfBox[0]!]
  for (let i = 1; i < diagram.actors.length; i++) {
    const gap = Math.max(
      halfBox[i - 1]! + halfBox[i]! + 2,
      adjMaxWidth[i - 1]! + 2,
      minLifelineGap,
    )
    llX[i] = llX[i - 1]! + gap
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

  let curY = actorBoxH // start right below header boxes

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

    if (isSelf) {
      // Self-message occupies 3+ rows: top-arm, label-col(s), bottom-arm
      msgLabelY[m] = curY + 1
      msgArrowY[m] = curY
      curY += 2 + msgLineCount // top-arm + label lines + bottom-arm
    } else {
      // Normal message: label row(s) then arrow row
      msgLabelY[m] = curY
      msgArrowY[m] = curY + msgLineCount // arrow goes after all label lines
      curY += msgLineCount + 1 // label lines + arrow row
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
  const footerY = curY
  const totalH = footerY + actorBoxH

  // Total canvas width
  const lastLL = llX[llX.length - 1] ?? 0
  const lastHalf = halfBox[halfBox.length - 1] ?? 0
  let totalW = lastLL + lastHalf + 2

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
   */
  function drawActorBox(cx: number, topY: number, label: string): void {
    const lines = splitLines(label)
    const maxW = maxLineWidth(label)
    const w = maxW + 2 * boxPad + 2
    const h = lines.length + 2 // lines + top/bottom border
    const left = cx - Math.floor(w / 2)

    // Top border
    setC(left, topY, TL, 'border')
    for (let x = 1; x < w - 1; x++) setC(left + x, topY, H, 'border')
    setC(left + w - 1, topY, TR, 'border')

    // Content lines (centered horizontally within the box)
    for (let i = 0; i < lines.length; i++) {
      const row = topY + 1 + i
      setC(left, row, V, 'border')
      setC(left + w - 1, row, V, 'border')
      // Center this line within the box. Centering offset and cell-writing
      // both use display width (terminal columns), not `.length` (JS
      // code units) — a code-unit-based offset would under-center CJK
      // labels, and writing one grid cell per code unit (rather than per
      // terminal column) would under-reserve columns for wide glyphs,
      // both contributing to issue #334's border/content misalignment.
      const line = lines[i]!
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

  for (let i = 0; i < diagram.actors.length; i++) {
    const x = llX[i]!
    for (let y = actorBoxH; y <= footerY; y++) {
      setC(x, y, V, 'line')
    }
  }

  // ---- DRAW: actor header + footer boxes (drawn over lifelines) ----

  for (let i = 0; i < diagram.actors.length; i++) {
    const actor = diagram.actors[i]!
    drawActorBox(llX[i]!, 0, actor.label)
    drawActorBox(llX[i]!, footerY, actor.label)

    // Lifeline junctions on box borders (Unicode only)
    if (!useAscii) {
      setC(llX[i]!, actorBoxH - 1, JT, 'junction')
      setC(llX[i]!, footerY, JB, 'junction')
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
        for (let x = fromX + 1; x < toX; x++) setC(x, arrowY, lineChar, 'line')
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
        setC(toX, arrowY, ah, 'arrow')
        // Bidirectional (`<<->>` / `<<-->>`): mirror the arrowhead at the
        // departure end too. Both bidirectional tokens end in ">>" (see
        // parser.ts), so isFilled is always true here — no open-head
        // variant to branch on, unlike the one-way `ah` glyph above.
        if (msg.bidirectional) {
          const ahStart = useAscii ? '<' : '◀'
          setC(fromX, arrowY, ahStart, 'arrow')
        }
      } else {
        for (let x = toX + 1; x < fromX; x++) setC(x, arrowY, lineChar, 'line')
        const ah = isLost
          ? lostChar
          : isFilled
            ? useAscii
              ? '<'
              : '◀'
            : useAscii
              ? '<'
              : '◁'
        setC(toX, arrowY, ah, 'arrow')
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
          if (start > toX) {
            for (let i = 0; i < numStr.length; i++)
              setC(start + i, arrowY, numStr[i]!, 'text')
          }
        }
      }
    }
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
