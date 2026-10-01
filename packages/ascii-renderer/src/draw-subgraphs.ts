// ============================================================================
// ASCII renderer — subgraph drawing (border rectangle + label)
//
// Split out of draw.ts.
// ============================================================================

import type {
  Canvas,
  DrawingCoord,
  AsciiGraph,
  AsciiSubgraph,
} from './types.ts'
import { mkCanvas, write } from './canvas.ts'
import { splitLines } from './multiline-utils.ts'
import { displayWidth, toDisplayCells } from './display-width.ts'

/** Draw a subgraph border rectangle. */
export function drawSubgraphBox(sg: AsciiSubgraph, graph: AsciiGraph): Canvas {
  const width = sg.maxX - sg.minX
  const height = sg.maxY - sg.minY
  if (width <= 0 || height <= 0) return mkCanvas(0, 0)

  const from: DrawingCoord = { x: 0, y: 0 }
  const to: DrawingCoord = { x: width, y: height }
  const canvas = mkCanvas(width, height)

  if (!graph.config.useAscii) {
    for (let x = from.x + 1; x < to.x; x++) write(canvas, x, from.y, '─')
    for (let x = from.x + 1; x < to.x; x++) write(canvas, x, to.y, '─')
    for (let y = from.y + 1; y < to.y; y++) write(canvas, from.x, y, '│')
    for (let y = from.y + 1; y < to.y; y++) write(canvas, to.x, y, '│')
    write(canvas, from.x, from.y, '┌')
    write(canvas, to.x, from.y, '┐')
    write(canvas, from.x, to.y, '└')
    write(canvas, to.x, to.y, '┘')
  } else {
    for (let x = from.x + 1; x < to.x; x++) write(canvas, x, from.y, '-')
    for (let x = from.x + 1; x < to.x; x++) write(canvas, x, to.y, '-')
    for (let y = from.y + 1; y < to.y; y++) write(canvas, from.x, y, '|')
    for (let y = from.y + 1; y < to.y; y++) write(canvas, to.x, y, '|')
    write(canvas, from.x, from.y, '+')
    write(canvas, to.x, from.y, '+')
    write(canvas, from.x, to.y, '+')
    write(canvas, to.x, to.y, '+')
  }

  return canvas
}

/**
 * A single cell of a subgraph title's own footprint — including cells whose
 * character is a literal space (e.g. the space inside "US West Region").
 * Callers use this to force those cells to win over whatever was already
 * drawn underneath (see the caller in `draw.ts` for why: `mergeCanvases`
 * treats overlay spaces as transparent, which lets a connector line drawn
 * earlier show through a label's internal spaces — issue #447).
 */
export interface SubgraphLabelCell {
  x: number
  y: number
}

/**
 * Glyphs that make up a vertical edge stroke (solid, dashed, thick, ASCII)
 * plus the crossing junction. A canvas cell holding one of these in a title
 * row means an edge runs through that row of the frame (#1222).
 */
const VERTICAL_STROKES = new Set([
  '│',
  '┃',
  '║',
  '┆',
  '┊',
  '|',
  ':',
  '‖',
  '┼',
  '╋',
])

/** True when `ch` is part of a vertical edge stroke. */
export function isVerticalStroke(ch: string | undefined): boolean {
  return ch !== undefined && VERTICAL_STROKES.has(ch)
}

/**
 * Choose where a title line starts so a vertical edge entering the frame
 * stays continuous through the title row (#1222). `blocked(x)` says whether
 * column `x` (frame-local) carries an edge stroke on this row.
 *
 * Preference order, nearest to the centred start `want` within each tier:
 *   1. the title slides aside, one clear column between it and the stroke;
 *   2. the same with no gap (the title abuts the stroke);
 *   3. otherwise `null` — the title would have to split or hide behind the
 *      stroke. Grid layout widens the frame on the side away from the stroke
 *      until a tier above fits (`widenFramesForTitleStrokes`, #1248); only
 *      if no width up to the cap works does the caller fall back to `want`,
 *      where the title wins and the stroke is hidden behind it, because
 *      overwriting a letter would garble the text.
 */
function pickTitleStart(
  cells: readonly string[],
  want: number,
  width: number,
  blocked: (x: number) => boolean,
): number | null {
  const clash = (start: number, gap: number): boolean => {
    for (let x = start - gap; x < start + cells.length + gap; x++) {
      if (x < 1 || x >= width) continue
      if (blocked(x)) return true
    }
    return false
  }
  // The centred start only stands when it keeps a clear column on each side;
  // abutting a stroke reads as the title being part of a narrow box (`│Two│`).
  if (!clash(want, 1)) return want
  const last = Math.max(1, width - cells.length)
  for (const gap of [1, 0]) {
    let best = -1
    for (let s = 1; s <= last; s++) {
      if (clash(s, gap)) continue
      if (best < 0 || Math.abs(s - want) < Math.abs(best - want)) best = s
    }
    if (best >= 0) return best
  }
  return null
}

/** The centred start column of a title line in a frame `width` wide. */
function centredStart(cells: readonly string[], width: number): number {
  return Math.max(1, 1 + Math.ceil((width - 1 - cells.length) / 2))
}

/**
 * Whether `line` can be placed in a frame `width` wide with a clear column
 * between it and every vertical stroke (tier 1 of `pickTitleStart`); abutting
 * a stroke does not count. Grid layout uses this to decide whether a frame
 * needs widening (#1222).
 */
export function titleAvoidsStrokes(
  line: string,
  width: number,
  blocked: (x: number) => boolean,
): boolean {
  const cells = toDisplayCells(line)
  const start = pickTitleStart(
    cells,
    centredStart(cells, width),
    width,
    blocked,
  )
  if (start === null) return false
  // Whether the start it picked keeps the clear column (tier 1), or only abuts.
  for (let x = start - 1; x < start + cells.length + 1; x++) {
    if (x >= 1 && x < width && blocked(x)) return false
  }
  return true
}

/**
 * Draw a subgraph label centered in its header area. Supports multi-line labels.
 *
 * `isStroke(x, y)` (frame-local coordinates, optional) reports whether a
 * vertical edge stroke already occupies that cell; the title then slides
 * aside instead of hiding or splitting around the edge (see `pickTitleStart`).
 */
// `_graph` isn't read here but is kept to match the `(sg, graph)` signature
// shared by the other `draw*` subgraph helpers in this file.
export function drawSubgraphLabel(
  sg: AsciiSubgraph,
  _graph: AsciiGraph,
  isStroke: (x: number, y: number) => boolean = () => false,
): [Canvas, DrawingCoord, SubgraphLabelCell[]] {
  const width = sg.maxX - sg.minX
  const height = sg.maxY - sg.minY
  if (width <= 0 || height <= 0) return [mkCanvas(0, 0), { x: 0, y: 0 }, []]

  const canvas = mkCanvas(width, height)
  const footprint: SubgraphLabelCell[] = []

  // Support multi-line subgraph labels
  const lines = splitLines(sg.name)

  // Start at row 1 inside subgraph, expand downward for multiple lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const labelY = 1 + i
    // Center the label within the interior columns (1..width-1, i.e.
    // excluding both border columns). When the interior width minus the
    // label width is odd, the leftover column can't be split evenly — bias
    // it to the right (keep >=1 space on the left) so the title never hugs
    // the left border. Using floor(width/2) - floor(label/2) here instead
    // biases the leftover to the left, which can zero out the left padding
    // entirely for even-length labels in an odd-width interior.
    let labelX = 1 + Math.ceil((width - 1 - displayWidth(line)) / 2)
    if (labelX < 1) labelX = 1
    const cells = toDisplayCells(line)
    labelX =
      pickTitleStart(cells, labelX, width, (x) => isStroke(x, labelY)) ?? labelX

    // Unlike `write()`'s own bounds (inclusive of the canvas edge — correct
    // for the border-drawing calls in `drawSubgraphBox` above, which write
    // the border itself at x == width / y == height), the label must stay
    // strictly inside the border, so this loop enforces the tighter,
    // exclusive bound itself rather than relying on `write()`'s clip.
    for (let j = 0; j < cells.length; j++) {
      if (labelX + j >= width || labelY >= height) continue
      // A space of the title sitting on an edge stroke leaves the stroke be.
      if (cells[j] === ' ' && isStroke(labelX + j, labelY)) continue
      write(canvas, labelX + j, labelY, cells[j]!)
      footprint.push({ x: labelX + j, y: labelY })
    }
  }

  return [canvas, { x: sg.minX, y: sg.minY }, footprint]
}
