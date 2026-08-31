// ============================================================================
// ASCII renderer — direction system and edge path determination
//
// Ported from AlexanderGrooff/mermaid-ascii cmd/direction.go + cmd/mapping_edge.go.
// Handles direction constants, edge attachment point selection,
// and dual-path comparison for optimal edge routing.
// ============================================================================

import type { GridCoord, Direction, AsciiEdge, AsciiGraph } from './types.ts'
import {
  Up,
  Down,
  Left,
  Right,
  UpperRight,
  UpperLeft,
  LowerRight,
  LowerLeft,
  Middle,
  gridCoordDirection,
  dirEquals,
  requireCardinalDirection,
} from './types.ts'
import { routeEdge, mergePath } from './pathfinder.ts'
import { getNodeSubgraph, requireGridCoord } from './grid.ts'
import { displayWidth } from './display-width.ts'
import { isOccupied, pathCells } from './grid-occupancy.ts'

// Re-exported for existing consumers (draw-arrows.ts, draw-lines.ts,
// draw-bundles.ts, shapes/*.ts) that import dirEquals from this module —
// the implementation itself lives in types.ts now, alongside the other
// coordinate-equality helpers (gridCoordEquals, drawingCoordEquals).
export { dirEquals }

// ============================================================================
// Direction utilities
// ============================================================================

export function getOpposite(d: Direction): Direction {
  if (d === Up) return Down
  if (d === Down) return Up
  if (d === Left) return Right
  if (d === Right) return Left
  if (d === UpperRight) return LowerLeft
  if (d === UpperLeft) return LowerRight
  if (d === LowerRight) return UpperLeft
  if (d === LowerLeft) return UpperRight
  return Middle
}

/**
 * Determine 8-way direction from one coordinate to another.
 * Uses the coordinate difference to pick one of 8 cardinal/ordinal directions.
 */
export function determineDirection(
  from: { x: number; y: number },
  to: { x: number; y: number },
): Direction {
  if (from.x === to.x) {
    return from.y < to.y ? Down : Up
  } else if (from.y === to.y) {
    return from.x < to.x ? Right : Left
  } else if (from.x < to.x) {
    return from.y < to.y ? LowerRight : UpperRight
  } else {
    return from.y < to.y ? LowerLeft : UpperLeft
  }
}

// ============================================================================
// Start/end direction selection for edges
// ============================================================================

/** Self-reference routing (node points to itself). */
function selfReferenceDirection(
  graphDirection: string,
): [Direction, Direction, Direction, Direction] {
  if (graphDirection === 'LR') return [Right, Down, Down, Right]
  return [Down, Right, Right, Down]
}

/**
 * Determine preferred and alternative start/end directions for an edge.
 * Returns [preferredStart, preferredEnd, alternativeStart, alternativeEnd].
 *
 * The edge routing tries both pairs and picks the shorter path.
 * Direction selection depends on relative node positions and graph direction (LR vs TD).
 */
export function determineStartAndEndDir(
  edge: AsciiEdge,
  graphDirection: string,
): [Direction, Direction, Direction, Direction] {
  if (edge.from === edge.to) return selfReferenceDirection(graphDirection)

  const d = determineDirection(
    requireGridCoord(edge.from),
    requireGridCoord(edge.to),
  )

  let preferredDir: Direction
  let preferredOppositeDir: Direction
  let alternativeDir: Direction
  let alternativeOppositeDir: Direction

  const isBackwards =
    graphDirection === 'LR'
      ? dirEquals(d, Left) || dirEquals(d, UpperLeft) || dirEquals(d, LowerLeft)
      : dirEquals(d, Up) || dirEquals(d, UpperLeft) || dirEquals(d, UpperRight)

  if (dirEquals(d, LowerRight)) {
    if (graphDirection === 'LR') {
      preferredDir = Down
      preferredOppositeDir = Left
      alternativeDir = Right
      alternativeOppositeDir = Up
    } else {
      preferredDir = Right
      preferredOppositeDir = Up
      alternativeDir = Down
      alternativeOppositeDir = Left
    }
  } else if (dirEquals(d, UpperRight)) {
    if (graphDirection === 'LR') {
      preferredDir = Up
      preferredOppositeDir = Left
      alternativeDir = Right
      alternativeOppositeDir = Down
    } else {
      preferredDir = Right
      preferredOppositeDir = Down
      alternativeDir = Up
      alternativeOppositeDir = Left
    }
  } else if (dirEquals(d, LowerLeft)) {
    if (graphDirection === 'LR') {
      preferredDir = Down
      preferredOppositeDir = Down
      alternativeDir = Left
      alternativeOppositeDir = Up
    } else {
      preferredDir = Left
      preferredOppositeDir = Up
      alternativeDir = Down
      alternativeOppositeDir = Right
    }
  } else if (dirEquals(d, UpperLeft)) {
    if (graphDirection === 'LR') {
      preferredDir = Down
      preferredOppositeDir = Down
      alternativeDir = Left
      alternativeOppositeDir = Down
    } else {
      preferredDir = Right
      preferredOppositeDir = Right
      alternativeDir = Up
      alternativeOppositeDir = Right
    }
  } else if (isBackwards) {
    if (graphDirection === 'LR' && dirEquals(d, Left)) {
      preferredDir = Down
      preferredOppositeDir = Down
      alternativeDir = Left
      alternativeOppositeDir = Right
    } else if (graphDirection === 'TD' && dirEquals(d, Up)) {
      preferredDir = Right
      preferredOppositeDir = Right
      alternativeDir = Up
      alternativeOppositeDir = Down
    } else {
      preferredDir = d
      preferredOppositeDir = getOpposite(d)
      alternativeDir = d
      alternativeOppositeDir = getOpposite(d)
    }
  } else {
    // Default: go in the natural direction
    preferredDir = d
    preferredOppositeDir = getOpposite(d)
    alternativeDir = d
    alternativeOppositeDir = getOpposite(d)
  }

  return [
    preferredDir,
    preferredOppositeDir,
    alternativeDir,
    alternativeOppositeDir,
  ]
}

// ============================================================================
// Parallel edge (multi-edge) lane assignment
// ============================================================================

/**
 * Grid rows (for a horizontal departure) or columns (for a vertical
 * departure) between successive parallel-edge lanes. See
 * `buildParallelLanePath` below.
 */
const PARALLEL_LANE_STEP = 2

/**
 * Group edges that share both their source AND target node — true
 * parallel/multi-edges, e.g. `A -->|One| B` and `A -->|Two| B` — and tag
 * each with its 0-based position in the group plus the group's size, via
 * `edge.parallelLane`. `determinePath` below reads this to route every
 * edge past the first through a distinct offset lane instead of the
 * identical center path every one of them would otherwise compute
 * independently (see #329: identical paths meant identically-positioned
 * labels drawn on top of each other, corrupting each other's text).
 *
 * Self-loops are excluded (`edge.from === edge.to`): they're routed and
 * drawn as a dedicated loop shape, not a lane-offset line between two
 * distinct nodes, so they're out of scope here.
 *
 * Must run before `analyzeEdgeBundles` (edge-bundling.ts): that module's
 * `canBundle` also refuses to fold a true-parallel group into one shared
 * fan-in/fan-out trunk (see its own doc comment), but the two checks are
 * independent — this function is the one that actually assigns lanes for
 * `determinePath` to use.
 */
export function assignParallelEdgeLanes(graph: AsciiGraph): void {
  const groups = new Map<string, AsciiEdge[]>()
  for (const edge of graph.edges) {
    if (edge.from === edge.to) continue // self-loop: not in scope here
    const key = `${edge.from.name} ${edge.to.name}`
    const existing = groups.get(key)
    if (existing) existing.push(edge)
    else groups.set(key, [edge])
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue
    for (let i = 0; i < group.length; i++) {
      group[i]!.parallelLane = { index: i, total: group.length }
    }
  }
}

/**
 * Build an offset-lane path for a non-first edge in a parallel-edge group:
 * leave the source node at the same attachment point every sibling in the
 * group shares (consistent with how two edges are already allowed to share
 * a node's own border cell — see edge-cell-styles.ts's module doc), jog
 * `PARALLEL_LANE_STEP * laneIndex` grid units away from the group's shared
 * center line, travel the full distance on that offset lane, then jog back
 * to the target's attachment point.
 *
 * The offset always grows in one direction (never negative) so it can
 * never land on a grid row/column that already exists above/left of the
 * node block — `gridToDrawingCoord`'s row/column summation only handles
 * coordinates from 0 upward, and `increaseGridSizeForPath` (grid.ts) is
 * what actually grows the canvas for a lane's newly-introduced row/column.
 *
 * `preferredDir`/`preferredOppositeDir` are whatever `determineStartAndEndDir`
 * computed for this edge (identical for every edge in the group, since they
 * share the same from/to nodes) — always one of the four cardinal
 * directions. A horizontal departure (Left/Right) offsets by row; a
 * vertical departure (Up/Down) offsets by column.
 */
function buildParallelLanePath(
  graph: AsciiGraph,
  edge: AsciiEdge,
  preferredDir: Direction,
  preferredOppositeDir: Direction,
  laneIndex: number,
): GridCoord[] {
  const fromAttach = gridCoordDirection(
    requireGridCoord(edge.from),
    preferredDir,
  )
  const toAttach = gridCoordDirection(
    requireGridCoord(edge.to),
    preferredOppositeDir,
  )
  const offset = PARALLEL_LANE_STEP * laneIndex
  const horizontalDeparture =
    dirEquals(preferredDir, Left) || dirEquals(preferredDir, Right)

  if (horizontalDeparture) {
    const laneY = fromAttach.y + offset
    return mergePath([
      fromAttach,
      { x: fromAttach.x, y: laneY },
      { x: toAttach.x, y: laneY },
      toAttach,
    ])
  }

  const laneX = fromAttach.x + offset
  return mergePath([
    fromAttach,
    { x: laneX, y: fromAttach.y },
    { x: laneX, y: toAttach.y },
    toAttach,
  ])
}

// ============================================================================
// Edge path determination
// ============================================================================

/**
 * Determine the path for an edge by trying two candidate routes (preferred + alternative)
 * and picking the shorter one. Sets edge.path, edge.startDir, edge.endDir.
 *
 * When both A* paths fail (common for edges crossing subgraph boundaries), falls back
 * to a direct path using the start/end points. This ensures edges always have a path
 * for arrowhead rendering.
 *
 * Uses the effective direction for edge routing, respecting subgraph direction overrides
 * when both source and target are in the same subgraph.
 */
export function determinePath(graph: AsciiGraph, edge: AsciiEdge): void {
  // Determine effective direction for this edge
  // If both nodes are in the same subgraph with a direction override, use it
  // Otherwise, use the graph's direction (not source's effective direction)
  const sourceSg = getNodeSubgraph(graph, edge.from)
  const targetSg = getNodeSubgraph(graph, edge.to)
  const effectiveDir =
    sourceSg && sourceSg === targetSg && sourceSg.direction
      ? sourceSg.direction
      : graph.config.graphDirection

  const [
    preferredDir,
    preferredOppositeDir,
    alternativeDir,
    alternativeOppositeDir,
  ] = determineStartAndEndDir(edge, effectiveDir)

  // Edges after the first in a true-parallel (same source AND target) group
  // skip the normal preferred/alternative search entirely: that search
  // would just find the identical center path every sibling edge shares,
  // which is the root cause of #329. Route through an offset lane instead
  // so this edge's path — and therefore its independently-centered label
  // (determineLabelLine) — never overlaps a sibling's.
  if (edge.parallelLane && edge.parallelLane.index > 0) {
    edge.startDir = preferredDir
    edge.endDir = preferredOppositeDir
    edge.path = buildParallelLanePath(
      graph,
      edge,
      preferredDir,
      preferredOppositeDir,
      edge.parallelLane.index,
    )
    return
  }

  // Try preferred path — routeEdge tries an unobstructed direct L-shape
  // before falling back to A* (see routeEdge / tryDirectPath in
  // pathfinder.ts). determineStartAndEndDir only ever produces one of the
  // four pure cardinal directions (see its implementation above), but that
  // invariant lives in this function's control flow, not in Direction's
  // type, so it's narrowed explicitly at the routeEdge boundary rather than
  // trusted silently across the module.
  const prefFrom = gridCoordDirection(requireGridCoord(edge.from), preferredDir)
  const prefTo = gridCoordDirection(
    requireGridCoord(edge.to),
    preferredOppositeDir,
  )
  const preferredPath = routeEdge(
    graph,
    prefFrom,
    prefTo,
    requireCardinalDirection(preferredDir),
  )

  // Try alternative path
  const altFrom = gridCoordDirection(
    requireGridCoord(edge.from),
    alternativeDir,
  )
  const altTo = gridCoordDirection(
    requireGridCoord(edge.to),
    alternativeOppositeDir,
  )
  const alternativePath = routeEdge(
    graph,
    altFrom,
    altTo,
    requireCardinalDirection(alternativeDir),
  )

  // Case 1: Both paths found — pick the shorter one (routeEdge already merged each)
  if (preferredPath !== null && alternativePath !== null) {
    if (preferredPath.length <= alternativePath.length) {
      edge.startDir = preferredDir
      edge.endDir = preferredOppositeDir
      edge.path = preferredPath
    } else {
      edge.startDir = alternativeDir
      edge.endDir = alternativeOppositeDir
      edge.path = alternativePath
    }
    return
  }

  // Case 2: Only preferred path found
  if (preferredPath !== null) {
    edge.startDir = preferredDir
    edge.endDir = preferredOppositeDir
    edge.path = preferredPath
    return
  }

  // Case 3: Only alternative path found
  if (alternativePath !== null) {
    edge.startDir = alternativeDir
    edge.endDir = alternativeOppositeDir
    edge.path = alternativePath
    return
  }

  // Case 4: Both paths failed — create a direct fallback path
  // This happens for edges crossing subgraph boundaries where A* can't find
  // a clear route. We create a direct path from source to target exit points
  // so arrowheads can still be rendered correctly.
  edge.startDir = preferredDir
  edge.endDir = preferredOppositeDir
  edge.path = [prefFrom, prefTo]
}

/** Check whether grid column `x` falls inside any node's reserved 3-column block. */
function isNodeOccupiedColumn(graph: AsciiGraph, x: number): boolean {
  for (const node of graph.nodes) {
    const gc = node.gridCoord
    if (gc && x >= gc.x && x <= gc.x + 2) return true
  }
  return false
}

/**
 * Find the column closest to `ideal` (within [minX, maxX]) that isn't part
 * of any node's reserved block, searching outward in both directions. Falls
 * back to `ideal` itself if every column in range is node-occupied (e.g. a
 * very short segment squeezed between two nodes) — there's no better option.
 */
function findNonNodeColumn(
  graph: AsciiGraph,
  minX: number,
  maxX: number,
  ideal: number,
): number {
  if (!isNodeOccupiedColumn(graph, ideal)) return ideal
  for (let d = 1; d <= maxX - minX; d++) {
    const right = ideal + d
    if (right <= maxX && !isNodeOccupiedColumn(graph, right)) return right
    const left = ideal - d
    if (left >= minX && !isNodeOccupiedColumn(graph, left)) return left
  }
  return ideal
}

/**
 * Find the best line segment in an edge's path to place a label on.
 * Prefers vertical segments for TD/BT graphs and horizontal for LR/RL to avoid
 * label collisions when multiple edges share initial segments.
 * Falls back to the widest segment if none are suitable.
 * Also increases the column width at the label position to fit the text.
 */
export function determineLabelLine(graph: AsciiGraph, edge: AsciiEdge): void {
  if (edge.text.length === 0) return

  const lenLabel = displayWidth(edge.text)
  const pathLen = edge.path.length

  // Collect all segments with their widths and orientation
  const segments: {
    line: [GridCoord, GridCoord]
    width: number
    index: number
    isVertical: boolean
  }[] = []

  for (let i = 1; i < pathLen; i++) {
    const p1 = edge.path[i - 1]!
    const p2 = edge.path[i]!
    const line: [GridCoord, GridCoord] = [p1, p2]
    const width = calculateLineWidth(graph, line)
    // A segment is vertical if X coords are same, horizontal if Y coords are same
    const isVertical = p1.x === p2.x
    segments.push({ line, width, index: i, isVertical })
  }

  // A segment whose *interior* (every cell strictly between its own two
  // endpoints — not the endpoints themselves, which are expected to touch
  // a node border or a path corner) passes through a cell owned by some
  // node's 3x3 block is a bad place for a label: the label text would be
  // drawn across that node's own box-drawing characters instead of open
  // grid. An ordinary A*/direct-routed path never does this (routing
  // itself avoids node-occupied cells), but edge-routing.ts's parallel
  // lane paths (buildParallelLanePath, for true multi-edges — see #329)
  // are constructed directly rather than pathfound, and their short jog
  // back into the target can otherwise look, by the width-only heuristic
  // below, like the best available segment even though it runs straight
  // across the target's own border row/column.
  const clearOfNodes = (line: [GridCoord, GridCoord]): boolean => {
    const cells = pathCells(line)
    for (let i = 1; i < cells.length - 1; i++) {
      if (isOccupied(graph.grid, cells[i]!)) return false
    }
    return true
  }

  // Find segments wide enough for the label, excluding the first segment
  // The first segment is often shared between edges from the same source node
  const suitableSegments = segments.filter(
    (s) => s.width >= lenLabel && s.index > 1 && clearOfNodes(s.line),
  )

  let largestLine: [GridCoord, GridCoord]

  if (suitableSegments.length > 0) {
    // Prefer segments near the end of the path (closer to target)
    // This avoids the shared initial segments from source
    suitableSegments.sort((a, b) => b.index - a.index)
    largestLine = suitableSegments[0]!.line
  } else {
    // Fall back to any suitable segment including the first
    const fallbackSegments = segments.filter(
      (s) => s.width >= lenLabel && clearOfNodes(s.line),
    )
    if (fallbackSegments.length > 0) {
      fallbackSegments.sort((a, b) => b.index - a.index)
      largestLine = fallbackSegments[0]!.line
    } else {
      // No segment both wide enough and clear of nodes — prefer the
      // widest segment that's at least clear of nodes (its column can
      // still be widened below to fit the label), falling back to the
      // widest segment overall only when every segment runs through a
      // node (nothing better available at all).
      const clearSegments = segments.filter((s) => clearOfNodes(s.line))
      const pool = clearSegments.length > 0 ? clearSegments : segments
      pool.sort((a, b) => b.width - a.width)
      if (pool.length > 0) {
        largestLine = pool[0]!.line
      } else {
        // No segments at all: edge.path has fewer than 2 points. This
        // happens when a routed edge's preferred from/to grid coordinates
        // coincide (e.g. closely-spaced/adjacent nodes), so getPath (see
        // pathfinder.ts) returns a single-point path. Treat it as a
        // degenerate zero-length line at that point instead of indexing
        // past the end of a 1-element (or empty) array.
        const only = edge.path[0] ?? { x: 0, y: 0 }
        largestLine = [only, only]
      }
    }
  }

  // Ensure column at midpoint is wide enough for the label.
  //
  // The chosen column must not be one a node itself occupies (its 3-column
  // border/content/border block, reserved in reserveSpotInGrid): a shared
  // trunk segment often passes directly over/adjacent to another node's
  // reserved columns on its way elsewhere, and if the label's midpoint
  // happens to land there, widening it to fit the label inflates that
  // node's own border-column width — which then drags things anchored to
  // that column's *center* (like the box-start ├/┤/┬/┴ connector in
  // draw-arrows.ts, computed via gridToDrawingCoord) away from the node's
  // actual, fixed-width rendered border. Search outward from the ideal
  // midpoint for the nearest column in the segment that isn't node-owned.
  const minX = Math.min(largestLine[0].x, largestLine[1].x)
  const maxX = Math.max(largestLine[0].x, largestLine[1].x)
  const idealX = minX + Math.floor((maxX - minX) / 2)
  const middleX = findNonNodeColumn(graph, minX, maxX, idealX)

  const current = graph.columnWidth.get(middleX) ?? 0
  graph.columnWidth.set(middleX, Math.max(current, lenLabel + 2))

  edge.labelLine = [largestLine[0], largestLine[1]]
}

/** Calculate the total character width of a line segment by summing column widths. */
function calculateLineWidth(
  graph: AsciiGraph,
  line: [GridCoord, GridCoord],
): number {
  let total = 0
  const startX = Math.min(line[0].x, line[1].x)
  const endX = Math.max(line[0].x, line[1].x)
  for (let x = startX; x <= endX; x++) {
    total += graph.columnWidth.get(x) ?? 0
  }
  return total
}
