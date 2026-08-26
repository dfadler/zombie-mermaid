// ============================================================================
// ASCII renderer — arrow drawing (path, corners, arrowheads, box-start
// junctions, labels)
//
// Split out of draw.ts.
// ============================================================================

import type {
  Canvas,
  DrawingCoord,
  GridCoord,
  Direction,
  AsciiGraph,
  AsciiEdge,
  AsciiEdgeStyle,
  AsciiNode,
} from './types.ts'
import {
  Up,
  Down,
  Left,
  Right,
  UpperLeft,
  UpperRight,
  LowerLeft,
  LowerRight,
  Middle,
  drawingCoordEquals,
} from './types.ts'
import { copyCanvas, drawText } from './canvas.ts'
import { determineDirection, dirEquals } from './edge-routing.ts'
import { gridToDrawingCoord, lineToDrawing } from './grid.ts'
import { splitLines } from './multiline-utils.ts'
import { drawLine } from './draw-lines.ts'

/**
 * Draw a complete arrow (edge) between two nodes.
 * Returns 6 separate canvases for layered compositing:
 * [path, boxStart, arrowHeadEnd, arrowHeadStart, corners, label]
 *
 * Supports bidirectional arrows via edge.hasArrowStart and edge.hasArrowEnd.
 */
export function drawArrow(
  graph: AsciiGraph,
  edge: AsciiEdge,
): [Canvas, Canvas, Canvas, Canvas, Canvas, Canvas] {
  if (edge.path.length === 0) {
    const empty = copyCanvas(graph.canvas)
    return [empty, empty, empty, empty, empty, empty]
  }

  const labelCanvas = drawArrowLabel(graph, edge)
  const [pathCanvas, linesDrawn, lineDirs] = drawPath(
    graph,
    edge.path,
    edge.style,
  )
  const boxStartCanvas = drawBoxStart(
    graph,
    edge.path,
    linesDrawn[0]!,
    edge.from,
  )

  // Draw end arrowhead only if hasArrowEnd is true (default behavior)
  let arrowHeadEndCanvas: Canvas
  if (edge.hasArrowEnd) {
    arrowHeadEndCanvas = drawArrowHead(
      graph,
      linesDrawn[linesDrawn.length - 1]!,
      lineDirs[lineDirs.length - 1]!,
    )
  } else {
    arrowHeadEndCanvas = copyCanvas(graph.canvas)
  }

  // Draw start arrowhead for bidirectional edges
  // The start arrowhead needs to be at the box connector position (one step back
  // from the first line point), pointing into the source node.
  let arrowHeadStartCanvas: Canvas
  if (edge.hasArrowStart && linesDrawn.length > 0) {
    const firstLine = linesDrawn[0]!
    const firstPoint = firstLine[0]!
    const startDir = reverseDirection(lineDirs[0]!)

    // Calculate the box connector position (one step back from first point)
    const arrowPos: DrawingCoord = { x: firstPoint.x, y: firstPoint.y }
    if (dirEquals(lineDirs[0]!, Right)) arrowPos.x = firstPoint.x - 1
    else if (dirEquals(lineDirs[0]!, Left)) arrowPos.x = firstPoint.x + 1
    else if (dirEquals(lineDirs[0]!, Down)) arrowPos.y = firstPoint.y - 1
    else if (dirEquals(lineDirs[0]!, Up)) arrowPos.y = firstPoint.y + 1

    // Create a synthetic line ending at the arrow position for drawArrowHead
    const syntheticLine: DrawingCoord[] = [firstPoint, arrowPos]
    arrowHeadStartCanvas = drawArrowHead(graph, syntheticLine, startDir)
  } else {
    arrowHeadStartCanvas = copyCanvas(graph.canvas)
  }

  const cornersCanvas = drawCorners(graph, edge.path)

  return [
    pathCanvas,
    boxStartCanvas,
    arrowHeadEndCanvas,
    arrowHeadStartCanvas,
    cornersCanvas,
    labelCanvas,
  ]
}

/**
 * Reverse a direction (for bidirectional arrow start heads).
 */
function reverseDirection(dir: Direction): Direction {
  if (dirEquals(dir, Up)) return Down
  if (dirEquals(dir, Down)) return Up
  if (dirEquals(dir, Left)) return Right
  if (dirEquals(dir, Right)) return Left
  if (dirEquals(dir, UpperLeft)) return LowerRight
  if (dirEquals(dir, UpperRight)) return LowerLeft
  if (dirEquals(dir, LowerLeft)) return UpperRight
  if (dirEquals(dir, LowerRight)) return UpperLeft
  return Middle
}

/**
 * Draw the path lines for an edge.
 * Returns the canvas, the coordinates drawn for each segment, and the direction of each segment.
 */
function drawPath(
  graph: AsciiGraph,
  path: GridCoord[],
  style: AsciiEdgeStyle = 'solid',
): [Canvas, DrawingCoord[][], Direction[]] {
  const canvas = copyCanvas(graph.canvas)
  let previousCoord = path[0]!
  const linesDrawn: DrawingCoord[][] = []
  const lineDirs: Direction[] = []

  for (let i = 1; i < path.length; i++) {
    const nextCoord = path[i]!
    const prevDC = gridToDrawingCoord(graph, previousCoord)
    const nextDC = gridToDrawingCoord(graph, nextCoord)

    if (drawingCoordEquals(prevDC, nextDC)) {
      previousCoord = nextCoord
      continue
    }

    const dir = determineDirection(previousCoord, nextCoord)
    const segment = drawLine(
      canvas,
      prevDC,
      nextDC,
      1,
      -1,
      graph.config.useAscii,
      style,
    )
    if (segment.length === 0) segment.push(prevDC)
    linesDrawn.push(segment)
    lineDirs.push(dir)
    previousCoord = nextCoord
  }

  return [canvas, linesDrawn, lineDirs]
}

/**
 * Draw the junction character where an edge exits the source node's box.
 * Unicode mode uses shape-specific T-junction glyphs; ASCII mode uses the
 * same universal '+' already used for corners in draw-boxes.ts.
 * Skips drawing for state pseudo-states which have their own visual borders.
 */
function drawBoxStart(
  graph: AsciiGraph,
  path: GridCoord[],
  firstLine: DrawingCoord[],
  sourceNode: AsciiNode,
): Canvas {
  const canvas = copyCanvas(graph.canvas)
  const useAscii = graph.config.useAscii

  // Skip box start connectors for state pseudo-states (they have their own bordered design)
  if (sourceNode.shape === 'state-start' || sourceNode.shape === 'state-end') {
    return canvas
  }

  const from = firstLine[0]!
  const dir = determineDirection(path[0]!, path[1]!)
  const junction = useAscii ? '+' : null

  if (dirEquals(dir, Up)) canvas[from.x]![from.y + 1] = junction ?? '┴'
  else if (dirEquals(dir, Down)) canvas[from.x]![from.y - 1] = junction ?? '┬'
  else if (dirEquals(dir, Left) || dirEquals(dir, Right)) {
    // Anchor horizontal connectors to the source node's *own* rendered
    // border column, not to gridToDrawingCoord's grid-column-centered
    // position. That position is centered within the node's border grid
    // column using that column's *allocated* width — but a sibling edge's
    // label can land on that same column (its labelLine's chosen segment
    // just happens to pass through the node's border column on its way
    // elsewhere) and widen it well past the 1-character width the border
    // itself needs. Centering on the inflated width then drags the
    // connector away from the box's actual border character, which stays
    // put at a position that only depends on the box's own dimensions.
    // Node dimensions are set before edge routing/drawing (see
    // createMapping in grid.ts), so drawingCoord/drawing are always
    // present here.
    const dc = sourceNode.drawingCoord!
    const boxWidth = sourceNode.drawing!.length
    if (dirEquals(dir, Left)) canvas[dc.x]![from.y] = junction ?? '┤'
    else canvas[dc.x + boxWidth - 1]![from.y] = junction ?? '├'
  }

  return canvas
}

/**
 * Draw the arrowhead at the end of an edge path.
 * Uses triangular Unicode symbols (▲▼◄►) or ASCII symbols (^v<>).
 */
function drawArrowHead(
  graph: AsciiGraph,
  lastLine: DrawingCoord[],
  fallbackDir: Direction,
): Canvas {
  const canvas = copyCanvas(graph.canvas)
  if (lastLine.length === 0) return canvas

  const from = lastLine[0]!
  const lastPos = lastLine[lastLine.length - 1]!
  let dir = determineDirection(from, lastPos)
  if (lastLine.length === 1 || dirEquals(dir, Middle)) dir = fallbackDir

  let char: string

  if (!graph.config.useAscii) {
    if (dirEquals(dir, Up)) char = '▲'
    else if (dirEquals(dir, Down)) char = '▼'
    else if (dirEquals(dir, Left)) char = '◄'
    else if (dirEquals(dir, Right)) char = '►'
    else if (dirEquals(dir, UpperRight)) char = '◥'
    else if (dirEquals(dir, UpperLeft)) char = '◤'
    else if (dirEquals(dir, LowerRight)) char = '◢'
    else if (dirEquals(dir, LowerLeft)) char = '◣'
    else {
      // Fallback
      if (dirEquals(fallbackDir, Up)) char = '▲'
      else if (dirEquals(fallbackDir, Down)) char = '▼'
      else if (dirEquals(fallbackDir, Left)) char = '◄'
      else if (dirEquals(fallbackDir, Right)) char = '►'
      else if (dirEquals(fallbackDir, UpperRight)) char = '◥'
      else if (dirEquals(fallbackDir, UpperLeft)) char = '◤'
      else if (dirEquals(fallbackDir, LowerRight)) char = '◢'
      else if (dirEquals(fallbackDir, LowerLeft)) char = '◣'
      else char = '●'
    }
  } else {
    if (dirEquals(dir, Up)) char = '^'
    else if (dirEquals(dir, Down)) char = 'v'
    else if (dirEquals(dir, Left)) char = '<'
    else if (dirEquals(dir, Right)) char = '>'
    else {
      if (dirEquals(fallbackDir, Up)) char = '^'
      else if (dirEquals(fallbackDir, Down)) char = 'v'
      else if (dirEquals(fallbackDir, Left)) char = '<'
      else if (dirEquals(fallbackDir, Right)) char = '>'
      else char = '*'
    }
  }

  canvas[lastPos.x]![lastPos.y] = char
  return canvas
}

/**
 * Draw corner characters at path bends (where the direction changes).
 * Uses ┌┐└┘ in Unicode mode, + in ASCII mode.
 */
function drawCorners(graph: AsciiGraph, path: GridCoord[]): Canvas {
  const canvas = copyCanvas(graph.canvas)

  for (let idx = 1; idx < path.length - 1; idx++) {
    const coord = path[idx]!
    const dc = gridToDrawingCoord(graph, coord)
    const prevDir = determineDirection(path[idx - 1]!, coord)
    const nextDir = determineDirection(coord, path[idx + 1]!)

    let corner: string
    if (!graph.config.useAscii) {
      if (
        (dirEquals(prevDir, Right) && dirEquals(nextDir, Down)) ||
        (dirEquals(prevDir, Up) && dirEquals(nextDir, Left))
      ) {
        corner = '┐'
      } else if (
        (dirEquals(prevDir, Right) && dirEquals(nextDir, Up)) ||
        (dirEquals(prevDir, Down) && dirEquals(nextDir, Left))
      ) {
        corner = '┘'
      } else if (
        (dirEquals(prevDir, Left) && dirEquals(nextDir, Down)) ||
        (dirEquals(prevDir, Up) && dirEquals(nextDir, Right))
      ) {
        corner = '┌'
      } else if (
        (dirEquals(prevDir, Left) && dirEquals(nextDir, Up)) ||
        (dirEquals(prevDir, Down) && dirEquals(nextDir, Right))
      ) {
        corner = '└'
      } else {
        corner = '+'
      }
    } else {
      corner = '+'
    }

    canvas[dc.x]![dc.y] = corner
  }

  return canvas
}

/** Draw edge label text centered on the widest path segment. */
function drawArrowLabel(graph: AsciiGraph, edge: AsciiEdge): Canvas {
  const canvas = copyCanvas(graph.canvas)
  if (edge.text.length === 0) return canvas

  const drawingLine = lineToDrawing(graph, edge.labelLine)

  // Determine if this is an upward edge (target is above source in the path)
  // This is used to offset labels on bidirectional edges to prevent overlap
  let isUpwardEdge: boolean | undefined
  if (edge.path.length >= 2) {
    const startY = edge.path[0]!.y
    const endY = edge.path[edge.path.length - 1]!.y
    // Edge goes up if end Y is less than start Y (smaller Y = higher on screen)
    if (endY < startY) {
      isUpwardEdge = true
    } else if (endY > startY) {
      isUpwardEdge = false
    }
    // If endY === startY, it's horizontal, leave isUpwardEdge undefined
  }

  drawTextOnLine(canvas, drawingLine, edge.text, isUpwardEdge)
  return canvas
}

/**
 * Draw text centered on a line segment defined by two drawing coordinates.
 * Supports multi-line labels.
 *
 * When isUpwardEdge is provided, offsets the label vertically to prevent
 * overlapping with labels from edges going the opposite direction:
 * - Upward edges: label placed in lower portion of segment
 * - Downward edges (isUpwardEdge=false): label placed in upper portion
 * - No direction (isUpwardEdge=undefined): label centered (default)
 */
function drawTextOnLine(
  canvas: Canvas,
  line: DrawingCoord[],
  label: string,
  isUpwardEdge?: boolean,
): void {
  if (line.length < 2) return
  const minX = Math.min(line[0]!.x, line[1]!.x)
  const maxX = Math.max(line[0]!.x, line[1]!.x)
  const minY = Math.min(line[0]!.y, line[1]!.y)
  const maxY = Math.max(line[0]!.y, line[1]!.y)
  const middleX = minX + Math.floor((maxX - minX) / 2)
  let middleY = minY + Math.floor((maxY - minY) / 2)

  // Offset label vertically to prevent overlap on bidirectional edges
  // For vertical segments (same X), shift based on edge direction
  if (isUpwardEdge !== undefined && minX === maxX) {
    const segmentHeight = maxY - minY
    const offset = Math.max(1, Math.floor(segmentHeight / 4))
    if (isUpwardEdge) {
      // Upward edge: place label in lower portion
      middleY = middleY + offset
    } else {
      // Downward edge: place label in upper portion
      middleY = middleY - offset
    }
  }

  // Support multi-line labels
  const lines = splitLines(label)
  const startY = middleY - Math.floor((lines.length - 1) / 2)

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i]!
    const startX = middleX - Math.floor(lineText.length / 2)
    drawText(canvas, { x: startX, y: startY + i }, lineText)
  }
}
