// ============================================================================
// Real silhouettes for stadium and hexagon (#2164)
// ============================================================================
//
// Mermaid draws a stadium as a pill (semicircular ends) and a hexagon with
// points at the left and right middle. Both are drawn here with curve and
// diagonal glyphs instead of a rectangle with swapped corner glyphs:
//
//   stadium                hexagon (5 rows)
//   ╭────────╮               ╱────────╲
//   (        )              ╱          ╲
//   (  Label )             <   Label    >
//   (        )              ╲          ╱
//   ╰────────╯               ╲────────╱
//
// ASCII charset: `.` `'` corners, `(` `)` sides, `/` `\` `<` `>` for the
// hexagon. Every glyph is a single cell wide, so a wide (CJK/emoji) label
// never changes where the border sits; only the label's own cells are wide.
// A diagonal costs one column per row. The label rows keep it clear of the
// text, so the hexagon grows wider only when its label is tall or narrow
// (hexagonDimensions below).

import type { Canvas } from '../types.ts'
import { splitLines } from '../multiline-utils.ts'
import { mkCanvas } from '../canvas.ts'
import { displayWidth, toDisplayCells } from '../display-width.ts'
import { getBoxDimensions } from './rectangle.ts'
import type { ShapeDimensions, ShapeRenderOptions } from './types.ts'

/** Cells kept clear between a hexagon's diagonal and its label text. */
const HEX_GAP = 1

/** Left column of the label text, matching drawBoxWithGridDimensions. */
export const labelStartX = (w: number, lineWidth: number): number =>
  Math.floor(w / 2) - Math.ceil(lineWidth / 2) + 1

/**
 * Hexagon indent (columns from the node's left edge) for every row 0..h,
 * where `w`/`h` are the last column/row index. Row distance from the middle
 * row, capped so the top edge keeps a cell and no diagonal touches label
 * text. The middle row (the point) is 0.
 */
export function hexagonInsets(
  w: number,
  h: number,
  lineWidths: readonly number[],
  startY: number,
): number[] {
  const lo = Math.floor(h / 2)
  const hi = Math.ceil(h / 2)
  const insets: number[] = []
  for (let y = 0; y <= h; y++) {
    let d = y <= lo ? lo - y : y - hi
    d = Math.min(d, Math.floor((w - 2) / 2))
    const lw = lineWidths[y - startY]
    if (lw !== undefined) d = Math.min(d, labelStartX(w, lw) - 1 - HEX_GAP)
    insets.push(Math.max(d, 0))
  }
  return insets
}

/** Draw a stadium border into a canvas whose last column/row are `w`/`h`. */
export function drawStadium(
  canvas: Canvas,
  w: number,
  h: number,
  useAscii: boolean,
): void {
  const [tl, tr, bl, br] = useAscii
    ? ['.', '.', "'", "'"]
    : ['╭', '╮', '╰', '╯']
  const hChar = useAscii ? '-' : '─'
  canvas[0]![0] = tl!
  canvas[w]![0] = tr!
  canvas[0]![h] = bl!
  canvas[w]![h] = br!
  for (let x = 1; x < w; x++) {
    canvas[x]![0] = hChar
    canvas[x]![h] = hChar
  }
  for (let y = 1; y < h; y++) {
    canvas[0]![y] = '('
    canvas[w]![y] = ')'
  }
}

/** Draw a hexagon border; `insets` comes from hexagonInsets. */
export function drawHexagon(
  canvas: Canvas,
  w: number,
  h: number,
  insets: readonly number[],
  useAscii: boolean,
): void {
  const hChar = useAscii ? '-' : '─'
  const [up, down] = useAscii ? ['/', '\\'] : ['╱', '╲']
  const lo = Math.floor(h / 2)
  for (let y = 0; y <= h; y++) {
    const d = insets[y]!
    const top = y <= lo
    const mid = d === 0 && y !== 0 && y !== h
    // Top half leans up-right on the left side, bottom half down-right.
    const left = mid ? '<' : top ? up! : down!
    const right = mid ? '>' : top ? down! : up!
    canvas[d]![y] = left
    canvas[w - d]![y] = right
    if (y === 0 || y === h) {
      for (let x = d + 1; x < w - d; x++) canvas[x]![y] = hChar
    }
  }
}

/** Stadium and hexagon use the box's grid cell; the hexagon may widen it. */
export function hexagonDimensions(
  label: string,
  options: ShapeRenderOptions,
): ShapeDimensions {
  const base = getBoxDimensions(label, options)
  const lines = splitLines(label)
  const widths = lines.map((l) => displayWidth(l))
  const rows = base.height // outer row count (odd)
  const startY = Math.floor((rows - 1) / 2) - Math.floor((lines.length - 1) / 2)
  let width = base.width
  // The top row needs one dash between its two diagonals.
  width = Math.max(width, 2 * Math.floor((rows - 1) / 2) + 2)
  for (let grow = 0; grow < 64; grow++) {
    const ins = hexagonInsets(width - 1, rows - 1, widths, startY)
    const mid = Math.floor((rows - 1) / 2)
    const ok =
      ins[0] === mid &&
      widths.every((_, i) => ins[startY + i] === Math.abs(mid - startY - i))
    if (ok) break
    width++
  }
  const innerWidth = width - 2
  return { ...base, width, gridColumns: [1, innerWidth, 1] }
}

/** Standalone render of a stadium or hexagon, label centred (same as drawBox). */
export function renderSilhouette(
  kind: 'stadium' | 'hexagon',
  label: string,
  dimensions: ShapeDimensions,
  useAscii: boolean,
): Canvas {
  const w = dimensions.width - 1
  const h = dimensions.height - 1
  const canvas = mkCanvas(w, h)
  const lines = splitLines(label)
  const startY = Math.floor(h / 2) - Math.floor((lines.length - 1) / 2)
  if (kind === 'stadium') drawStadium(canvas, w, h, useAscii)
  else {
    const widths = lines.map((l) => displayWidth(l))
    drawHexagon(canvas, w, h, hexagonInsets(w, h, widths, startY), useAscii)
  }
  for (const [i, line] of lines.entries()) {
    const x0 = labelStartX(w, displayWidth(line))
    for (const [j, cell] of toDisplayCells(line).entries()) {
      const x = x0 + j
      // Clip to the interior so an oversized label never overwrites a border.
      if (x > 0 && x < w && startY + i >= 0 && startY + i <= h)
        canvas[x]![startY + i] = cell
    }
  }
  return canvas
}
