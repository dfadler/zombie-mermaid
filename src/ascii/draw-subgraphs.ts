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

/** Draw a subgraph label centered in its header area. Supports multi-line labels. */
// `_graph` isn't read here but is kept to match the `(sg, graph)` signature
// shared by the other `draw*` subgraph helpers in this file.
export function drawSubgraphLabel(
  sg: AsciiSubgraph,
  _graph: AsciiGraph,
): [Canvas, DrawingCoord] {
  const width = sg.maxX - sg.minX
  const height = sg.maxY - sg.minY
  if (width <= 0 || height <= 0) return [mkCanvas(0, 0), { x: 0, y: 0 }]

  const canvas = mkCanvas(width, height)

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
    for (let j = 0; j < cells.length; j++) {
      write(canvas, labelX + j, labelY, cells[j]!)
    }
  }

  return [canvas, { x: sg.minX, y: sg.minY }]
}
