// ============================================================================
// ASCII renderer — bundled edge drawing (for parallel links, A & B --> C)
//
// Split out of draw.ts. Renders the fan-in/fan-out bundles computed by
// ./edge-bundling.ts (junction points, shared trunks) onto the canvas.
// ============================================================================

import type {
  Canvas,
  DrawingCoord,
  Direction,
  AsciiGraph,
  AsciiNode,
  AsciiEdge,
  EdgeBundle,
} from './types.ts'
import { Up, Down, Left, Right, drawingCoordEquals } from './types.ts'
import { copyCanvas, write } from './canvas.ts'
import { determineDirection, dirEquals } from './edge-routing.ts'
import { gridToDrawingCoord } from './grid.ts'
import { getShapeAttachmentPoint } from './shapes/index.ts'
import type { ShapeDimensions } from './shapes/index.ts'
import { drawLine } from './draw-lines.ts'

// ============================================================================
// Node attachment point helper
// ============================================================================

/**
 * Get the drawing coordinate where an edge attaches to a node's border.
 * Uses grid-allocated dimensions so attachment points align with the actual
 * drawn box (which may be wider/taller than the intrinsic shape dimensions
 * when sharing a column/row with a larger node).
 */
function getNodeAttachmentPoint(
  graph: AsciiGraph,
  node: AsciiNode,
  dir: Direction,
): DrawingCoord {
  const gc = node.gridCoord
  if (gc === null) {
    // Every node reaching bundled-edge drawing has already been placed by
    // the grid layout pass (see grid.ts's createMapping) — a null here
    // means drawing ran before layout, an upstream invariant violation
    // rather than a value this function can recover from.
    /* v8 ignore next */
    throw new Error(
      `Node "${node.name}" has no gridCoord; grid layout must run before bundled-edge drawing`,
    )
  }

  // Calculate actual drawn dimensions from grid (matching drawBoxWithGridDimensions)
  let w = 0
  for (let i = 0; i < 2; i++) {
    w += graph.columnWidth.get(gc.x + i) ?? 0
  }
  let h = 0
  for (let i = 0; i < 2; i++) {
    h += graph.rowHeight.get(gc.y + i) ?? 0
  }

  // Build dimensions matching the actual drawn box size
  const gridDimensions: ShapeDimensions = {
    width: w + 1,
    height: h + 1,
    labelArea: { x: 0, y: 0, width: 0, height: 0 },
    gridColumns: [0, 0, 0],
    gridRows: [0, 0, 0],
  }

  const baseCoord = node.drawingCoord
  if (baseCoord === null) {
    // Same invariant as gridCoord above: drawingCoord is derived from
    // gridCoord during layout, so it's set for every placed node.
    /* v8 ignore next */
    throw new Error(
      `Node "${node.name}" has no drawingCoord; grid layout must run before bundled-edge drawing`,
    )
  }
  return getShapeAttachmentPoint(node.shape, dir, gridDimensions, baseCoord)
}

/**
 * Draw a single edge's segment in a bundle (source → junction for fan-in,
 * junction → target for fan-out).
 *
 * Returns the same tuple format as drawArrow for consistency.
 */
export function drawBundledEdgeSegment(
  graph: AsciiGraph,
  edge: AsciiEdge,
  bundle: EdgeBundle,
): [Canvas, Canvas, Canvas, Canvas, Canvas, Canvas] {
  const empty = copyCanvas(graph.canvas)

  // Captured as a local so its non-null, non-empty narrowing survives into
  // the closures below — narrowing a property access like
  // `edge.pathToJunction` does not persist inside a callback (the compiler
  // can't rule out the callback mutating it), but narrowing a local const
  // does.
  const pathToJunction = edge.pathToJunction
  if (!pathToJunction || pathToJunction.length === 0) {
    return [empty, empty, empty, empty, empty, empty]
  }

  // Draw the path segment (pathToJunction)
  const pathCanvas = copyCanvas(graph.canvas)
  const useAscii = graph.config.useAscii

  // Convert grid coords to drawing coords
  // For fan-in: first point is at source node border (use attachment point)
  // For fan-out: last point is at target node border (use attachment point)
  const drawingPath = pathToJunction.map((gc, idx) => {
    if (bundle.type === 'fan-in' && idx === 0) {
      // First point: use source node's actual border position
      return getNodeAttachmentPoint(graph, edge.from, edge.startDir)
    }
    if (bundle.type === 'fan-out' && idx === pathToJunction.length - 1) {
      // Last point: use target node's actual border position
      return getNodeAttachmentPoint(graph, edge.to, edge.endDir)
    }
    return gridToDrawingCoord(graph, gc)
  })

  // Draw line segments
  for (let i = 1; i < drawingPath.length; i++) {
    const from = drawingPath[i - 1]!
    const to = drawingPath[i]!
    if (!drawingCoordEquals(from, to)) {
      // Always skip both endpoints of every segment (offset 1, -1),
      // matching non-bundled drawPath behavior. This leaves endpoint
      // characters to corner/junction/boxStart canvases, preventing
      // line characters from corrupting them via mergeJunctions.
      drawLine(pathCanvas, from, to, 1, -1, useAscii, edge.style)
    }
  }

  // Draw corners at path bends
  const cornersCanvas = copyCanvas(graph.canvas)
  for (let idx = 1; idx < pathToJunction.length - 1; idx++) {
    const coord = pathToJunction[idx]!
    const dc = gridToDrawingCoord(graph, coord)
    const prevDir = determineDirection(pathToJunction[idx - 1]!, coord)
    const nextDir = determineDirection(coord, pathToJunction[idx + 1]!)

    let corner: string
    if (!useAscii) {
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

    write(cornersCanvas, dc.x, dc.y, corner)
  }

  // Draw box start connector (for fan-in, from source node)
  // The connector is placed at the first point coordinate (box border position)
  // since we use offsets 1,-1 for drawLine, the line starts one step past this point
  const boxStartCanvas = copyCanvas(graph.canvas)
  if (bundle.type === 'fan-in' && pathToJunction.length >= 2) {
    const firstPoint = drawingPath[0]!
    const dir = determineDirection(pathToJunction[0]!, pathToJunction[1]!)

    const junction = useAscii ? '+' : null
    if (dirEquals(dir, Up))
      write(boxStartCanvas, firstPoint.x, firstPoint.y, junction ?? '┴')
    else if (dirEquals(dir, Down))
      write(boxStartCanvas, firstPoint.x, firstPoint.y, junction ?? '┬')
    else if (dirEquals(dir, Left))
      write(boxStartCanvas, firstPoint.x, firstPoint.y, junction ?? '┤')
    else if (dirEquals(dir, Right))
      write(boxStartCanvas, firstPoint.x, firstPoint.y, junction ?? '├')
  }

  // Label canvas (bundled edges typically don't have labels, but handle it)
  const labelCanvas = copyCanvas(graph.canvas)

  return [pathCanvas, boxStartCanvas, empty, empty, cornersCanvas, labelCanvas]
}

/**
 * Draw the shared path segment of a bundle (junction → target for fan-in,
 * source → junction for fan-out).
 */
export function drawBundleSharedPath(
  graph: AsciiGraph,
  bundle: EdgeBundle,
): [Canvas, Canvas] {
  const pathCanvas = copyCanvas(graph.canvas)
  const cornersCanvas = copyCanvas(graph.canvas)

  if (bundle.sharedPath.length < 2) {
    return [pathCanvas, cornersCanvas]
  }

  const useAscii = graph.config.useAscii
  const style = bundle.edges[0]?.style ?? 'solid'
  const graphDir = graph.config.graphDirection

  // Convert grid coords to drawing coords
  // For fan-in: last point is at target node border
  // For fan-out: first point is at source node border
  const drawingPath = bundle.sharedPath.map((gc, idx) => {
    if (bundle.type === 'fan-in' && idx === bundle.sharedPath.length - 1) {
      // Last point: use target node's actual border position (entry from above/left)
      const entryDir = graphDir === 'TD' ? Up : Left
      return getNodeAttachmentPoint(graph, bundle.sharedNode, entryDir)
    }
    if (bundle.type === 'fan-out' && idx === 0) {
      // First point: use source node's actual border position (exit going down/right)
      const exitDir = graphDir === 'TD' ? Down : Right
      return getNodeAttachmentPoint(graph, bundle.sharedNode, exitDir)
    }
    return gridToDrawingCoord(graph, gc)
  })

  // Draw line segments with appropriate offsets
  for (let i = 1; i < drawingPath.length; i++) {
    const from = drawingPath[i - 1]!
    const to = drawingPath[i]!
    if (!drawingCoordEquals(from, to)) {
      // Always skip both endpoints (offset 1, -1), matching non-bundled drawPath.
      drawLine(pathCanvas, from, to, 1, -1, useAscii, style)
    }
  }

  // Draw corners at path bends
  for (let idx = 1; idx < bundle.sharedPath.length - 1; idx++) {
    const coord = bundle.sharedPath[idx]!
    const dc = gridToDrawingCoord(graph, coord)
    const prevDir = determineDirection(bundle.sharedPath[idx - 1]!, coord)
    const nextDir = determineDirection(coord, bundle.sharedPath[idx + 1]!)

    let corner: string
    if (!useAscii) {
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

    write(cornersCanvas, dc.x, dc.y, corner)
  }

  return [pathCanvas, cornersCanvas]
}

/**
 * Draw the arrowhead for a fan-in bundle (single arrowhead at the shared target).
 */
export function drawBundleArrowhead(
  graph: AsciiGraph,
  bundle: EdgeBundle,
): Canvas {
  const canvas = copyCanvas(graph.canvas)

  if (bundle.sharedPath.length < 2) return canvas

  // Get the last segment direction
  const lastIdx = bundle.sharedPath.length - 1
  const secondLast = bundle.sharedPath[lastIdx - 1]!
  const last = bundle.sharedPath[lastIdx]!
  const dir = determineDirection(secondLast, last)

  // Get drawing coord 1 char outside the target node's border (not on the border itself).
  // This matches non-bundled edges where drawPath uses offsetTo=-1 and the arrowhead
  // sits at the last drawn point (1 char before the border).
  const graphDir = graph.config.graphDirection
  const entryDir = graphDir === 'TD' ? Up : Left
  const dc = getNodeAttachmentPoint(graph, bundle.sharedNode, entryDir)
  // Offset 1 char away from the box border so arrowhead sits outside the box
  if (graphDir === 'TD') dc.y -= 1
  else dc.x -= 1

  // Draw arrowhead
  let char: string
  if (!graph.config.useAscii) {
    if (dirEquals(dir, Up)) char = '▲'
    else if (dirEquals(dir, Down)) char = '▼'
    else if (dirEquals(dir, Left)) char = '◄'
    else if (dirEquals(dir, Right)) char = '►'
    else char = '▼' // default
  } else {
    if (dirEquals(dir, Up)) char = '^'
    else if (dirEquals(dir, Down)) char = 'v'
    else if (dirEquals(dir, Left)) char = '<'
    else if (dirEquals(dir, Right)) char = '>'
    else char = 'v' // default
  }

  write(canvas, dc.x, dc.y, char)
  return canvas
}

/**
 * Draw the arrowhead for a single edge in a fan-out bundle.
 */
export function drawBundledEdgeArrowhead(
  graph: AsciiGraph,
  edge: AsciiEdge,
): Canvas {
  const canvas = copyCanvas(graph.canvas)

  if (!edge.pathToJunction || edge.pathToJunction.length < 2) return canvas

  // Get the last segment direction
  const lastIdx = edge.pathToJunction.length - 1
  const secondLast = edge.pathToJunction[lastIdx - 1]!
  const last = edge.pathToJunction[lastIdx]!
  const dir = determineDirection(secondLast, last)

  // Get drawing coord 1 char outside the target node's border
  const graphDir = graph.config.graphDirection
  const entryDir = graphDir === 'TD' ? Up : Left
  const dc = getNodeAttachmentPoint(graph, edge.to, entryDir)
  // Offset 1 char away from the box border so arrowhead sits outside the box
  if (graphDir === 'TD') dc.y -= 1
  else dc.x -= 1

  // Draw arrowhead
  let char: string
  if (!graph.config.useAscii) {
    if (dirEquals(dir, Up)) char = '▲'
    else if (dirEquals(dir, Down)) char = '▼'
    else if (dirEquals(dir, Left)) char = '◄'
    else if (dirEquals(dir, Right)) char = '►'
    else char = '▼' // default
  } else {
    if (dirEquals(dir, Up)) char = '^'
    else if (dirEquals(dir, Down)) char = 'v'
    else if (dirEquals(dir, Left)) char = '<'
    else if (dirEquals(dir, Right)) char = '>'
    else char = 'v' // default
  }

  write(canvas, dc.x, dc.y, char)
  return canvas
}

/**
 * Draw the junction character where bundled edges merge/split.
 *
 * Analyzes actual connecting directions to choose the correct character:
 * - ┼ (cross): lines from all 4 directions
 * - ┬ (T down): lines from left, right, and down
 * - ┴ (T up): lines from left, right, and up
 * - ├ (T right): lines from up, down, and right
 * - ┤ (T left): lines from up, down, and left
 */
export function drawJunctionCharacter(
  graph: AsciiGraph,
  bundle: EdgeBundle,
): Canvas {
  const canvas = copyCanvas(graph.canvas)

  if (!bundle.junctionPoint) return canvas

  const dc = gridToDrawingCoord(graph, bundle.junctionPoint)
  const useAscii = graph.config.useAscii

  // Analyze what directions actually connect to the junction
  let hasUp = false
  let hasDown = false
  let hasLeft = false
  let hasRight = false

  // Check shared path direction (where the line continues to/from the shared node)
  if (bundle.sharedPath.length >= 2) {
    // For fan-in: shared path goes FROM junction TO target (index 0 is junction)
    // For fan-out: shared path goes FROM source TO junction (last index is junction)
    const junctionIdx =
      bundle.type === 'fan-in' ? 0 : bundle.sharedPath.length - 1
    const adjacentIdx =
      bundle.type === 'fan-in' ? 1 : bundle.sharedPath.length - 2
    const sharedDir = determineDirection(
      bundle.sharedPath[junctionIdx]!,
      bundle.sharedPath[adjacentIdx]!,
    )
    // This is the direction the shared path GOES from junction
    if (dirEquals(sharedDir, Down)) hasDown = true
    else if (dirEquals(sharedDir, Up)) hasUp = true
    else if (dirEquals(sharedDir, Right)) hasRight = true
    else if (dirEquals(sharedDir, Left)) hasLeft = true
  }

  // Check each edge's path direction at the junction
  for (const edge of bundle.edges) {
    if (edge.pathToJunction && edge.pathToJunction.length >= 2) {
      // For fan-in: pathToJunction goes FROM source TO junction (last is junction)
      // For fan-out: pathToJunction goes FROM junction TO target (first is junction)
      const junctionIdx =
        bundle.type === 'fan-in' ? edge.pathToJunction.length - 1 : 0
      const adjacentIdx =
        bundle.type === 'fan-in' ? edge.pathToJunction.length - 2 : 1

      const arrivalDir = determineDirection(
        edge.pathToJunction[adjacentIdx]!,
        edge.pathToJunction[junctionIdx]!,
      )
      // This is the direction the edge ARRIVES at junction from
      // e.g., if arrivalDir is Right, the line comes FROM the left
      if (dirEquals(arrivalDir, Down))
        hasUp = true // arrived going down = came from up
      else if (dirEquals(arrivalDir, Up)) hasDown = true
      else if (dirEquals(arrivalDir, Right)) hasLeft = true
      else if (dirEquals(arrivalDir, Left)) hasRight = true
    }
  }

  // Select character based on connected directions
  let char: string
  if (!useAscii) {
    if (hasUp && hasDown && hasLeft && hasRight) {
      char = '┼' // cross - all 4 directions
    } else if (hasDown && hasLeft && hasRight && !hasUp) {
      char = '┬' // T pointing down
    } else if (hasUp && hasLeft && hasRight && !hasDown) {
      char = '┴' // T pointing up
    } else if (hasUp && hasDown && hasRight && !hasLeft) {
      char = '├' // T pointing right
    } else if (hasUp && hasDown && hasLeft && !hasRight) {
      char = '┤' // T pointing left
    } else if (hasLeft && hasRight) {
      char = '─' // horizontal only
    } else if (hasUp && hasDown) {
      char = '│' // vertical only
    } else if (hasDown && hasRight) {
      char = '┌' // corner
    } else if (hasDown && hasLeft) {
      char = '┐'
    } else if (hasUp && hasRight) {
      char = '└'
    } else if (hasUp && hasLeft) {
      char = '┘'
    } else {
      char = '┼' // fallback
    }
  } else {
    char = '+'
  }

  write(canvas, dc.x, dc.y, char)
  return canvas
}
