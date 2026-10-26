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

/**
 * Diamond indent for rows 0..h: the point is the top/bottom row, the widest
 * row is the middle, and the slope is whatever lands the point on the centre
 * (mermaid's diamond is as tall as it is wide; ours keeps the node's rows, so
 * a wide label gets a shallow, sparse diagonal). Unclamped: diamondDimensions
 * widens the node until the label rows clear it.
 */
export function diamondInsets(w: number, h: number): number[] {
  const lo = Math.floor(h / 2)
  const hi = Math.ceil(h / 2)
  const top = Math.max(Math.floor((w - 1) / 2), 0)
  const insets: number[] = []
  for (let y = 0; y <= h; y++) {
    const d = y <= lo ? lo - y : y - hi
    insets.push(lo === 0 ? 0 : Math.round((d * top) / lo))
  }
  return insets
}

/**
 * Circle indent for rows 0..h: an ellipse two cells wide per row (a terminal
 * cell is about twice as tall as wide), rounded up so every row steps in.
 */
export function circleInsets(w: number, h: number): number[] {
  const lo = Math.floor(h / 2)
  const hi = Math.ceil(h / 2)
  const ry = lo + 0.5
  const insets: number[] = []
  for (let y = 0; y <= h; y++) {
    const d = y <= lo ? lo - y : y - hi
    const v = Math.ceil(2 * ry * (1 - Math.sqrt(1 - (d / ry) ** 2)) - 1e-9)
    insets.push(Math.min(v, Math.max(Math.floor((w - 2) / 2), 0)))
  }
  // A rounded corner's arm points down (up), so the row under it must hold the
  // outline in the same column; a 3-row circle has nothing there and is a pill.
  if (h < 4) return insets.map(() => 0)
  insets[0] = insets[1]!
  insets[h] = insets[h - 1]!
  return insets
}

/** Draw a circle border; `insets` comes from circleInsets. */
export function drawCircle(
  canvas: Canvas,
  w: number,
  h: number,
  insets: readonly number[],
  useAscii: boolean,
): void {
  const hChar = useAscii ? '-' : '─'
  const [tl, tr, bl, br] = useAscii
    ? ['.', '.', "'", "'"]
    : ['╭', '╮', '╰', '╯']
  const [up, down] = useAscii ? ['/', '\\'] : ['╱', '╲']
  const lo = Math.floor(h / 2)
  for (let y = 0; y <= h; y++) {
    const d = insets[y]!
    const top = y <= lo
    if (y === 0 || y === h) {
      canvas[d]![y] = y === 0 ? tl! : bl!
      canvas[w - d]![y] = y === 0 ? tr! : br!
      for (let x = d + 1; x < w - d; x++) canvas[x]![y] = hChar
    } else if (d === 0) {
      canvas[0]![y] = '('
      canvas[w]![y] = ')'
    } else {
      canvas[d]![y] = top ? up! : down!
      canvas[w - d]![y] = top ? down! : up!
    }
  }
}

/** Widen until each label row clears the diagonal (insets from `insetsOf`). */
function growToClearLabel(
  base: ShapeDimensions,
  widths: readonly number[],
  insetsOf: (w: number, h: number) => number[],
  evenWidth: boolean,
): ShapeDimensions {
  const rows = base.height
  const startY =
    Math.floor((rows - 1) / 2) - Math.floor((widths.length - 1) / 2)
  let width = base.width
  if (evenWidth && width % 2) width++
  const step = evenWidth ? 2 : 1
  for (let grow = 0; grow < 64; grow++) {
    const ins = insetsOf(width - 1, rows - 1)
    const clear = widths.every(
      (lw, i) =>
        ins[startY + i]! <= labelStartX(width - 1, lw) - 1 - HEX_GAP ||
        ins[startY + i] === 0,
    )
    if (clear) break
    width += step
  }
  return { ...base, width, gridColumns: [1, width - 2, 1] }
}

/** Diamond grid cell: the box's rows, widened (to an even width) for the label. */
export function diamondDimensions(
  label: string,
  options: ShapeRenderOptions,
): ShapeDimensions {
  const widths = splitLines(label).map((l) => displayWidth(l))
  return growToClearLabel(
    getBoxDimensions(label, options),
    widths,
    diamondInsets,
    true,
  )
}

/** Circle grid cell: the box's rows, widened so the top arc keeps a dash. */
export function circleDimensions(
  label: string,
  options: ShapeRenderOptions,
): ShapeDimensions {
  const widths = splitLines(label).map((l) => displayWidth(l))
  const base = getBoxDimensions(label, options)
  // The arc's two corners need a cell between them at the top and bottom.
  const minWidth = 2 * Math.max(...circleInsets(1e3, base.height - 1)) + 3
  return growToClearLabel(
    { ...base, width: Math.max(base.width, minWidth) },
    widths,
    circleInsets,
    false,
  )
}

/** True for the shapes drawn as a silhouette rather than a corner-glyph box. */
export const isSilhouetteShape = (shape: string): boolean =>
  shape === 'stadium' ||
  shape === 'hexagon' ||
  shape === 'diamond' ||
  shape === 'circle'

/** Stadium and hexagon use the box's grid cell; the hexagon may widen it. */
export function hexagonDimensions(
  label: string,
  options: ShapeRenderOptions,
): ShapeDimensions {
  const base = getBoxDimensions(label, options)
  const lines = splitLines(label)
  const widths = lines.map((l) => displayWidth(l))
  const rows = base.height // Outer row count (odd)
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
  kind: 'stadium' | 'hexagon' | 'diamond' | 'circle',
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
  else if (kind === 'diamond')
    drawHexagon(canvas, w, h, diamondInsets(w, h), useAscii)
  else if (kind === 'circle')
    drawCircle(canvas, w, h, circleInsets(w, h), useAscii)
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
