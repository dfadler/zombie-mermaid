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
import { mkCanvas } from './canvas.ts'
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
    for (let x = from.x + 1; x < to.x; x++) canvas[x]![from.y] = '─'
    for (let x = from.x + 1; x < to.x; x++) canvas[x]![to.y] = '─'
    for (let y = from.y + 1; y < to.y; y++) canvas[from.x]![y] = '│'
    for (let y = from.y + 1; y < to.y; y++) canvas[to.x]![y] = '│'
    canvas[from.x]![from.y] = '┌'
    canvas[to.x]![from.y] = '┐'
    canvas[from.x]![to.y] = '└'
    canvas[to.x]![to.y] = '┘'
  } else {
    for (let x = from.x + 1; x < to.x; x++) canvas[x]![from.y] = '-'
    for (let x = from.x + 1; x < to.x; x++) canvas[x]![to.y] = '-'
    for (let y = from.y + 1; y < to.y; y++) canvas[from.x]![y] = '|'
    for (let y = from.y + 1; y < to.y; y++) canvas[to.x]![y] = '|'
    canvas[from.x]![from.y] = '+'
    canvas[to.x]![from.y] = '+'
    canvas[from.x]![to.y] = '+'
    canvas[to.x]![to.y] = '+'
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
    let labelX = Math.floor(width / 2) - Math.floor(displayWidth(line) / 2)
    if (labelX < 1) labelX = 1

    const cells = toDisplayCells(line)
    for (let j = 0; j < cells.length; j++) {
      if (labelX + j < width && labelY < height) {
        canvas[labelX + j]![labelY] = cells[j]!
      }
    }
  }

  return [canvas, { x: sg.minX, y: sg.minY }]
}
