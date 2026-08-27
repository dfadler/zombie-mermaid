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
import type { AsciiConfig, CharRole, AsciiTheme, ColorMode } from './types.ts'
import {
  mkCanvas,
  mkRoleCanvas,
  canvasToString,
  increaseSize,
  increaseRoleCanvasSize,
  write,
} from './canvas.ts'
import { splitLines, maxLineWidth, lineCount } from './multiline-utils.ts'

// Width of a self-message's loop glyphs (├──┐ / ◀──┘), excluding the label.
// Shared between the drawing pass and the block-wall extent calculation so
// self-arrows inside alt/loop/opt blocks don't get clipped by the wall.
const SELF_LOOP_WIDTH = 4

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
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('%%'))
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

  const boxPad = 1
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

  // Compute lifeline x-positions (greedy left-to-right)
  const llX: number[] = [halfBox[0]!]
  for (let i = 1; i < diagram.actors.length; i++) {
    const gap = Math.max(
      halfBox[i - 1]! + halfBox[i]! + 2,
      adjMaxWidth[i - 1]! + 2,
      10,
    )
    llX[i] = llX[i - 1]! + gap
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

  // Pre-message notes: afterIndex === -1 — position before message loop
  for (const note of diagram.notes) {
    if (note.afterIndex !== -1) continue
    curY += 1 // gap before note
    const nLines = splitLines(note.text)
    const nWidth = Math.max(...nLines.map((l) => l.length)) + 4
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
        curY += 2 // 1 blank + 1 header row
        blockStartY.set(b, curY - 1)
      }
    }

    // Dividers at this message index
    for (let b = 0; b < diagram.blocks.length; b++) {
      for (let d = 0; d < diagram.blocks[b]!.dividers.length; d++) {
        if (diagram.blocks[b]!.dividers[d]!.index === m) {
          curY += 1
          divYMap.set(`${b}:${d}`, curY)
          curY += 1
        }
      }
    }

    curY += 1 // blank row before message

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
        curY += 1
        const note = diagram.notes[n]!
        const nLines = splitLines(note.text)
        const nWidth = Math.max(...nLines.map((l) => l.length)) + 4
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
        curY += 1
        blockEndY.set(b, curY)
        curY += 1
      }
    }
  }

  curY += 1 // gap before footer
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
        llX[fi]! + SELF_LOOP_WIDTH + 2 + 2 + maxLineWidth(msg.label)
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
    write(canvas, x, y, ch, role, rc)
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
      // Center this line within the box
      const line = lines[i]!
      const ls = left + 1 + boxPad + Math.floor((maxW - line.length) / 2)
      for (let j = 0; j < line.length; j++) {
        setC(ls + j, row, line[j]!, 'text')
      }
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

    // Arrow line character (solid vs dashed)
    const lineChar = isDashed ? (useAscii ? '.' : '╌') : H

    if (isSelf) {
      // Self-message: 3-row loop to the right of the lifeline
      //   ├──┐           (row 0 = msgArrowY)
      //   │  │ Label     (row 1)
      //   │◄─┘           (row 2)
      const y0 = msgArrowY[m]!
      const loopW = SELF_LOOP_WIDTH
      // Split the label on <br/>-normalized newlines so multi-line self-arrow
      // labels get one row each instead of dumping a literal \n mid-row.
      const msgLines = splitLines(msg.label)

      // Row 0: start junction + horizontal + top-right corner
      setC(fromX, y0, JL, 'junction')
      for (let x = fromX + 1; x < fromX + loopW; x++)
        setC(x, y0, lineChar, 'line')
      setC(fromX + loopW, y0, useAscii ? '+' : '┐', 'corner')

      // Label rows: vertical on right side + one line of label text each
      const labelX = fromX + loopW + 2
      for (let lineIdx = 0; lineIdx < msgLines.length; lineIdx++) {
        const rowY = y0 + 1 + lineIdx
        setC(fromX + loopW, rowY, V, 'line')
        const line = msgLines[lineIdx]!
        for (let i = 0; i < line.length; i++) {
          if (labelX + i < totalW) setC(labelX + i, rowY, line[i]!, 'text')
        }
      }

      // Bottom row: arrow-back + horizontal + bottom-right corner
      const bottomY = y0 + 1 + msgLines.length
      const arrowChar = isFilled ? (useAscii ? '<' : '◀') : useAscii ? '<' : '◁'
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
        const labelStart = midX - Math.floor(line.length / 2)
        const y = labelY + lineIdx
        for (let i = 0; i < line.length; i++) {
          const lx = labelStart + i
          if (lx >= 0 && lx < totalW) setC(lx, y, line[i]!, 'text')
        }
      }

      // Draw arrow line
      if (leftToRight) {
        for (let x = fromX + 1; x < toX; x++) setC(x, arrowY, lineChar, 'line')
        // Arrowhead at destination
        const ah = isFilled ? (useAscii ? '>' : '▶') : useAscii ? '>' : '▷'
        setC(toX, arrowY, ah, 'arrow')
      } else {
        for (let x = toX + 1; x < fromX; x++) setC(x, arrowY, lineChar, 'line')
        const ah = isFilled ? (useAscii ? '<' : '◀') : useAscii ? '<' : '◁'
        setC(toX, arrowY, ah, 'arrow')
      }
    }
  }

  // ---- DRAW: blocks (loop, alt, opt, par, etc.) ----

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
          llX[f]! + SELF_LOOP_WIDTH + 2 + maxLineWidth(msg.label)
        maxLX = Math.max(maxLX, selfRight)
      }
    }

    const bLeft = Math.max(0, minLX - 4)
    const bRight = Math.min(totalW - 1, maxLX + 4)

    // Top border with block type label
    setC(bLeft, topY, TL, 'border')
    for (let x = bLeft + 1; x < bRight; x++) setC(x, topY, H, 'border')
    setC(bRight, topY, TR, 'border')
    // Write block header label over the top border (supports multi-line)
    const hdrLabel = block.label ? `${block.type} [${block.label}]` : block.type
    const hdrLines = splitLines(hdrLabel)

    for (
      let lineIdx = 0;
      lineIdx < hdrLines.length && topY + lineIdx < botY;
      lineIdx++
    ) {
      const line = hdrLines[lineIdx]!
      for (let i = 0; i < line.length && bLeft + 1 + i < bRight; i++) {
        setC(bLeft + 1 + i, topY + lineIdx, line[i]!, 'text')
      }
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
        for (let i = 0; i < dStr.length && bLeft + 1 + i < bRight; i++) {
          setC(bLeft + 1 + i, dY, dStr[i]!, 'text')
        }
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
      for (let i = 0; i < np.lines[l]!.length; i++) {
        setC(np.x + 2 + i, ly, np.lines[l]![i]!, 'text')
      }
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
