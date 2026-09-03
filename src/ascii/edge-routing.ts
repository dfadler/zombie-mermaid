// ============================================================================
// ASCII renderer — direction system and edge path determination
//
// Ported from AlexanderGrooff/mermaid-ascii cmd/direction.go + cmd/mapping_edge.go.
// Handles direction constants, edge attachment point selection,
// and dual-path comparison for optimal edge routing.
// ============================================================================

import type {
  GridCoord,
  Direction,
  AsciiEdge,
  AsciiGraph,
  AsciiNode,
} from './types.ts'
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
import {
  getNodeSubgraph,
  gridToDrawingCoord,
  requireGridCoord,
} from './grid.ts'
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
 * Bound on how far `buildParallelLanePath` will push a lane outward
 * (1 grid unit per attempt) to escape a cell occupied by some *other*
 * node's reserved block. Generous enough for any realistic diagram (a
 * stack of many dozens of sibling rows/columns), while still bounding the
 * search — see that function's doc for why an unbounded search isn't safe
 * to assume will terminate quickly on a pathological graph.
 */
const MAX_LANE_OFFSET_SEARCH = 200

/** Whether `cell` falls inside `node`'s own reserved 3x3 block. */
function isCellInNodeBlock(node: AsciiNode, cell: GridCoord): boolean {
  const gc = node.gridCoord
  if (!gc) return false
  return (
    cell.x >= gc.x && cell.x <= gc.x + 2 && cell.y >= gc.y && cell.y <= gc.y + 2
  )
}

/**
 * Every cell in `cells` strictly between its own first and last entry is
 * free of any node's reserved block — except a block listed in `ownNodes`,
 * which is allowed. The first/last cells are excluded outright, because
 * callers use this on lines/paths whose two endpoints are expected to
 * touch a node border (where an edge departs/arrives) or an already-
 * validated waypoint; only cells genuinely *passed through* matter here.
 *
 * Two callers, two different `ownNodes`:
 *  - `determineLabelLine` calls this with no exemptions at all: label text
 *    drawn across *any* node's border — including the edge's own source or
 *    target — corrupts that node's box-drawing characters (see #329's
 *    "Second┬Arrow" regression), so nothing is exempt there.
 *  - `buildParallelLanePath` calls this with `[edge.from, edge.to]`
 *    exempted: an edge's line is *expected* to graze its own node's other
 *    border cells on the way to its actual attachment point — that's
 *    exactly how the ├/┤/┬/┴ box connector glyphs get chosen elsewhere in
 *    this renderer (see edge-cell-styles.ts's module doc for the same
 *    "an edge's own node border is a legitimate shared cell" reasoning).
 *    Only a *different*, unrelated node's block is a genuine collision
 *    there.
 */
function interiorCellsClearOfNodes(
  graph: AsciiGraph,
  cells: readonly GridCoord[],
  ownNodes: readonly AsciiNode[] = [],
): boolean {
  for (let i = 1; i < cells.length - 1; i++) {
    const cell = cells[i]!
    if (!isOccupied(graph.grid, cell)) continue
    if (ownNodes.some((n) => isCellInNodeBlock(n, cell))) continue
    return false
  }
  return true
}

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
    const usedOffsets = new Set<number>()
    for (let i = 0; i < group.length; i++) {
      group[i]!.parallelLane = { index: i, total: group.length, usedOffsets }
    }
  }
}

/**
 * Build an offset-lane path for a non-first edge in a parallel-edge group:
 * leave the source node at the same attachment point every sibling in the
 * group shares (consistent with how two edges are already allowed to share
 * a node's own border cell — see edge-cell-styles.ts's module doc), travel
 * an offset lane, then return to the target's attachment point. Two
 * candidate shapes are tried per offset, in order:
 *
 *  - **"wide"**: descend/cross straight down `fromAttach`'s own column/row,
 *    travel the *full* node-to-node span at the offset lane, then rise back
 *    up `toAttach`'s own column/row. This is what `determineLabelLine`
 *    wants — a segment already wide enough to host the label outright —
 *    and is correct whenever nothing else occupies that column/row at the
 *    chosen offset.
 *  - **"gutter"**: like "wide", but the two short jogs near each endpoint
 *    step one extra grid unit into the gutter column/row immediately
 *    before/after that node — reserved by every node's own
 *    `setColumnWidth` padding (`columnWidth.set(gc.x - 1, ...)` in
 *    grid.ts) and never claimed by `placeBlock` for *any* node, at *any*
 *    row/column, by construction of the grid-level spacing scheme (`x`/`y`
 *    levels are always `NODE_BLOCK_SIZE` + 1 apart). "wide" fails exactly
 *    when a second, independent `X --> Y` chain placed directly below
 *    `A`/`B` (a completely ordinary "second flow stacked under the first"
 *    layout) shares `A`'s/`B`'s exact border column, so "wide"'s straight
 *    descent runs right through `X`'s/`Y`'s own reserved block — "gutter"
 *    detours around exactly that, at the cost of a narrower (often single-
 *    column) middle segment; still a legitimate label location, just via
 *    determineLabelLine's node-avoidance fallback tier rather than its
 *    width-based one. (Routing each jog through `routeEdge`/A* was tried
 *    before landing on this: A* has no notion of "this occupied cell is my
 *    *own* node's, so it's fine to graze", so it detoured *away* from the
 *    source's/target's own border on every lane, producing a self-crossing
 *    zigzag instead of a clean jog.)
 *
 * Each candidate is validated via `interiorCellsClearOfNodes` (the edge's
 * own two nodes exempted — grazing them is expected, exactly like the
 * `edge-cell-styles.ts` "own node border is a legitimate shared cell"
 * reasoning) before being accepted. If neither shape is clear at the
 * current offset, it's pushed out one more grid unit and both are retried
 * — bounded by `MAX_LANE_OFFSET_SEARCH` — mirroring `findNonNodeColumn`'s
 * "search outward for a non-node column" pattern above, generalized to a
 * whole path.
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
 *
 * If every offset within the search bound is still blocked for both shapes
 * (a genuinely pathological, densely-stacked graph), the last attempted
 * path is returned anyway rather than failing the whole render — the same
 * graceful-degradation-over-a-hard-failure choice `findNonNodeColumn` and
 * `determinePath`'s Case-4 direct fallback already make elsewhere in this
 * file.
 */
/** A lane path plus the segment `determinePath` should use directly as
 * this edge's label line — see `buildParallelLanePath`'s doc for why this
 * is computed explicitly here rather than left to `determineLabelLine`'s
 * general (width-based) heuristic. */
interface ParallelLaneRoute {
  path: GridCoord[]
  labelSegment: [GridCoord, GridCoord]
}

function buildParallelLanePath(
  graph: AsciiGraph,
  edge: AsciiEdge,
  preferredDir: Direction,
  preferredOppositeDir: Direction,
  laneIndex: number,
): ParallelLaneRoute {
  const fromAttach = gridCoordDirection(
    requireGridCoord(edge.from),
    preferredDir,
  )
  const toAttach = gridCoordDirection(
    requireGridCoord(edge.to),
    preferredOppositeDir,
  )
  const horizontalDeparture =
    dirEquals(preferredDir, Left) || dirEquals(preferredDir, Right)
  const ownNodes = [edge.from, edge.to]
  // Shared, by reference, across every edge in this parallel group (see
  // types.ts's parallelLane doc) — records every offset a sibling lane has
  // already committed to, so two lanes that each have to detour around the
  // same obstacle can't converge on the identical offset (and therefore
  // the identical path — the exact bug this whole mechanism exists to
  // prevent, just between two lanes instead of the original center path).
  const usedOffsets = edge.parallelLane!.usedOffsets

  // One grid unit further from each node, in the direction the edge
  // already departs/arrives — lands in the permanently node-free gutter
  // (see doc above) rather than the node's own border column/row.
  const fromStep = dirEquals(preferredDir, Right)
    ? 1
    : dirEquals(preferredDir, Left)
      ? -1
      : dirEquals(preferredDir, Down)
        ? 1
        : -1
  const toStep = dirEquals(preferredOppositeDir, Right)
    ? 1
    : dirEquals(preferredOppositeDir, Left)
      ? -1
      : dirEquals(preferredOppositeDir, Down)
        ? 1
        : -1
  const fromGutter = horizontalDeparture
    ? { x: fromAttach.x + fromStep, y: fromAttach.y }
    : { x: fromAttach.x, y: fromAttach.y + fromStep }
  const toGutter = horizontalDeparture
    ? { x: toAttach.x + toStep, y: toAttach.y }
    : { x: toAttach.x, y: toAttach.y + toStep }

  // Always-valid fallback (ignores occupancy entirely) in case every
  // offset attempt below fails outright — mirrors determinePath's own
  // Case-4 direct fallback: an edge must always end up with *some* path so
  // its arrowhead can still be drawn. Its label segment is the same
  // degenerate zero-length line determineLabelLine itself falls back to
  // for a path with no real segments — see this function's caller.
  let path: GridCoord[] = [fromAttach, toAttach]
  let labelSegment: [GridCoord, GridCoord] = [fromAttach, toAttach]

  const startingOffset = PARALLEL_LANE_STEP * laneIndex
  for (let step = 0; step < MAX_LANE_OFFSET_SEARCH; step++) {
    const offset = startingOffset + step
    if (usedOffsets.has(offset)) continue
    const laneMain = fromAttach.y + offset
    const laneCross = fromAttach.x + offset

    // Candidate A ("wide"): travel the offset lane across the *full*
    // node-to-node span (fromAttach.x..toAttach.x, or the vertical
    // equivalent). Its middle segment is always genuinely wide (it spans
    // two distinct nodes' attachment columns/rows), so it's used directly
    // as the label segment — no need to search for it afterward. Tried
    // first because it's clearly the better-looking result whenever safe.
    const wideLabelSegment: [GridCoord, GridCoord] = horizontalDeparture
      ? [
          { x: fromAttach.x, y: laneMain },
          { x: toAttach.x, y: laneMain },
        ]
      : [
          { x: laneCross, y: fromAttach.y },
          { x: laneCross, y: toAttach.y },
        ]
    const wideCandidate = mergePath([fromAttach, ...wideLabelSegment, toAttach])
    if (interiorCellsClearOfNodes(graph, pathCells(wideCandidate), ownNodes)) {
      usedOffsets.add(offset)
      return { path: wideCandidate, labelSegment: wideLabelSegment }
    }
    path = wideCandidate
    labelSegment = wideLabelSegment

    // Candidate B ("gutter"): candidate A travels along fromAttach's/
    // toAttach's own border column/row for the vertical/horizontal jog,
    // which can run straight through an unrelated node sharing that same
    // column/row (see this function's doc) — candidate A's occupancy
    // check just caught exactly that. Detour those two short jogs through
    // the permanently node-free gutter instead.
    //
    // `fromGutter`/`toGutter` coincide exactly whenever the two nodes sit
    // on directly adjacent grid levels (the ordinary case for "two edges
    // between the same pair") — there being only one gutter column/row
    // between them. When that happens the "travel" segment collapses to a
    // single point, which every sibling lane's gutter candidate would
    // share identically — reintroducing #329's own bug, just between two
    // *lanes* instead of the original center path (this was caught while
    // building this fix: see ascii-parallel-edges-329.test.ts's "no lane
    // path passes through a cell owned by the unrelated X/Y chain" test).
    // Use the vertical/horizontal "spike" descent instead in that case — a
    // zero-length point *at* this lane's own offset depth, not a segment
    // spanning from the attach row/column down to it: drawTextOnLine
    // centers text at a line's *midpoint*, so a segment running from (say)
    // row 1 down to row 7 centers its label at row 4, not row 7 — two
    // lanes at different depths (rows 5 and 7, say) can still produce the
    // *same* midpoint as some other lane's own row, corrupting labels all
    // over again (also caught by the same test named above). A point's
    // min/max/midpoint are all itself, so the label always lands exactly
    // at this lane's own unique depth — narrow (its column/row is widened
    // below like any single-segment label host), but unique per lane.
    const gutterTravelHasWidth = horizontalDeparture
      ? fromGutter.x !== toGutter.x
      : fromGutter.y !== toGutter.y
    const gutterLabelSegment: [GridCoord, GridCoord] = horizontalDeparture
      ? gutterTravelHasWidth
        ? [
            { x: fromGutter.x, y: laneMain },
            { x: toGutter.x, y: laneMain },
          ]
        : [
            { x: fromGutter.x, y: laneMain },
            { x: fromGutter.x, y: laneMain },
          ]
      : gutterTravelHasWidth
        ? [
            { x: laneCross, y: fromGutter.y },
            { x: laneCross, y: toGutter.y },
          ]
        : [
            { x: laneCross, y: fromGutter.y },
            { x: laneCross, y: fromGutter.y },
          ]
    const gutterCandidate = horizontalDeparture
      ? mergePath([
          fromAttach,
          fromGutter,
          { x: fromGutter.x, y: laneMain },
          { x: toGutter.x, y: laneMain },
          toGutter,
          toAttach,
        ])
      : mergePath([
          fromAttach,
          fromGutter,
          { x: laneCross, y: fromGutter.y },
          { x: laneCross, y: toGutter.y },
          toGutter,
          toAttach,
        ])
    if (
      interiorCellsClearOfNodes(graph, pathCells(gutterCandidate), ownNodes)
    ) {
      usedOffsets.add(offset)
      return { path: gutterCandidate, labelSegment: gutterLabelSegment }
    }
    // Defensive — shouldn't normally happen. The gutter candidate's
    // vertical/horizontal travel runs entirely through the permanently
    // node-free gutter column/row (see this function's doc: every node's
    // own column-width padding reserves it, and placeBlock never claims
    // it for any node), so gutterCandidate failing this check would mean
    // that structural guarantee didn't hold for this graph's layout.
    // Recorded anyway so the loop's very last iteration still has a
    // best-effort path/labelSegment to fall back to.
    /* v8 ignore next */
    path = gutterCandidate
    /* v8 ignore next */
    labelSegment = gutterLabelSegment
  }
  // Defensive — shouldn't normally happen, for the same reason as above:
  // reaching here means every offset up to MAX_LANE_OFFSET_SEARCH failed
  // both candidates, which requires the gutter's structural guarantee to
  // not hold. Mirrors determinePath's own Case-4 direct fallback and
  // findNonNodeColumn's "every column occupied" fallback elsewhere in this
  // file: graceful degradation over a hard failure, not a case expected to
  // be exercised by a realistic graph.
  /* v8 ignore next */
  return { path, labelSegment }
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
  // so this edge's path — and its label — never overlaps a sibling's.
  //
  // The label line is set directly here (via applyLabelLine), not left for
  // determineLabelLine's later call to work out: buildParallelLanePath
  // already knows exactly which segment of the lane it just built is the
  // correct, sibling-distinct place for the label (see its own doc for why
  // determineLabelLine's general width-based heuristic can't reliably
  // re-derive that from the finished path alone). determineLabelLine
  // itself skips lane edges for exactly this reason — see its own guard.
  if (edge.parallelLane && edge.parallelLane.index > 0) {
    edge.startDir = preferredDir
    edge.endDir = preferredOppositeDir
    const route = buildParallelLanePath(
      graph,
      edge,
      preferredDir,
      preferredOppositeDir,
      edge.parallelLane.index,
    )
    edge.path = route.path
    if (edge.text.length > 0) {
      applyLabelLine(graph, edge, route.labelSegment, displayWidth(edge.text))
    }
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
 *
 * No-ops for an edge past the first in a parallel-edge group
 * (`edge.parallelLane.index > 0`): `determinePath` already called
 * `applyLabelLine` directly for it, with a segment `buildParallelLanePath`
 * chose explicitly rather than one this function's own width-based search
 * could reliably re-derive from the finished lane path alone (see that
 * function's doc) — re-running the search here would risk picking a
 * different, sibling-colliding segment instead.
 */
export function determineLabelLine(graph: AsciiGraph, edge: AsciiEdge): void {
  if (edge.text.length === 0) return
  if (edge.parallelLane && edge.parallelLane.index > 0) return

  const lenLabel = displayWidth(edge.text)
  const pathLen = edge.path.length

  // A candidate segment needs strictly more room than the label's own
  // character count: `calculateLineWidth` for a horizontal segment now
  // measures the actual drawing-space distance between its two endpoints
  // (see that function's doc), and centering a label of exactly that width
  // inside that distance still lands its first character on the segment's
  // starting endpoint — which, for a segment that approaches a node, *is*
  // that node's border column (issue #450). This mirrors the `+ 2` padding
  // `applyLabelLine` already reserves around the label once a segment is
  // chosen, so the segment-selection check and the space actually reserved
  // for it agree on what "enough room" means.
  const minSegmentWidth = lenLabel + 2

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
  const clearOfNodes = (line: [GridCoord, GridCoord]): boolean =>
    interiorCellsClearOfNodes(graph, pathCells(line))

  // Find segments wide enough for the label, excluding the first segment
  // The first segment is often shared between edges from the same source node
  const suitableSegments = segments.filter(
    (s) => s.width >= minSegmentWidth && s.index > 1 && clearOfNodes(s.line),
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
      (s) => s.width >= minSegmentWidth && clearOfNodes(s.line),
    )
    if (fallbackSegments.length > 0) {
      fallbackSegments.sort((a, b) => b.index - a.index)
      largestLine = fallbackSegments[0]!.line
    } else {
      // No segment both wide enough and clear of nodes — prefer the
      // widest segment that's at least clear of nodes (its column can
      // still be widened below to fit the label). Still prefer index > 1
      // here too: a multi-segment lane path (buildParallelLanePath) can
      // have every one of its later segments come up too narrow for this
      // tier (e.g. a single-gutter-column "gutter" candidate — see that
      // function's doc), and without this, the widest-clear-segment sort
      // below would happily fall back to the *first* segment purely
      // because it's typically the widest (it's on the shared trunk row
      // every sibling edge from the same source uses) — reintroducing the
      // exact same-row label collision this whole index > 1 exclusion
      // exists to prevent, just via this tier instead of the ones above.
      // Only fall back further — first to *any* clear segment regardless
      // of index, then to every segment — when nothing clear survives
      // even that relaxation (a single-segment edge with no room to
      // exclude anything, or a segment that runs through a node with no
      // alternative at all).
      const clearLaterSegments = segments.filter(
        (s) => s.index > 1 && clearOfNodes(s.line),
      )
      const clearSegments = segments.filter((s) => clearOfNodes(s.line))
      const pool =
        clearLaterSegments.length > 0
          ? clearLaterSegments
          : clearSegments.length > 0
            ? clearSegments
            : segments
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

  applyLabelLine(graph, edge, largestLine, lenLabel)
}

/**
 * Finish assigning a label to `line`: widen whichever column its midpoint
 * falls in enough to fit the label, then commit `edge.labelLine`. Shared
 * tail for `determineLabelLine`'s own segment-search heuristic above and
 * `buildParallelLanePath`'s explicit segment choice below — the latter
 * already knows exactly which segment is correct for its own lane (see
 * that function's doc for why the heuristic above can't reliably infer it
 * for a parallel-lane path), so it skips straight to this shared finish
 * instead of going through the search.
 *
 * The chosen column must not be one a node itself occupies (its 3-column
 * border/content/border block, reserved in reserveSpotInGrid): a shared
 * trunk segment often passes directly over/adjacent to another node's
 * reserved columns on its way elsewhere, and if the label's midpoint
 * happens to land there, widening it to fit the label inflates that
 * node's own border-column width — which then drags things anchored to
 * that column's *center* (like the box-start ├/┤/┬/┴ connector in
 * draw-arrows.ts, computed via gridToDrawingCoord) away from the node's
 * actual, fixed-width rendered border. Search outward from the ideal
 * midpoint for the nearest column in the segment that isn't node-owned.
 */
function applyLabelLine(
  graph: AsciiGraph,
  edge: AsciiEdge,
  line: [GridCoord, GridCoord],
  lenLabel: number,
): void {
  const minX = Math.min(line[0].x, line[1].x)
  const maxX = Math.max(line[0].x, line[1].x)
  const idealX = minX + Math.floor((maxX - minX) / 2)
  const middleX = findNonNodeColumn(graph, minX, maxX, idealX)

  const current = graph.columnWidth.get(middleX) ?? 0
  graph.columnWidth.set(middleX, Math.max(current, lenLabel + 2))

  edge.labelLine = [line[0], line[1]]
}

/**
 * Calculate the character width available for centering a label on a line
 * segment.
 *
 * For a vertical segment (both endpoints share an X column), this is that
 * column's own width — the horizontal room a centered label has to either
 * side of the line.
 *
 * For a horizontal segment, this used to sum every spanned column's *own*
 * width, but that over-counts the room actually available: `drawTextOnLine`
 * centers the label across the segment's *drawing-space* distance between
 * its two endpoints, and `gridToDrawingCoord` places a column at its
 * *center*, not its leading edge — so the real distance between two
 * adjacent columns is roughly half of each column's width, not the sum of
 * their full widths. A short final approach segment into a node (one grid
 * column wide, ending on that node's own border column) could pass the old
 * sum-based check by counting a distant column's generous width, then get
 * centered with its first character landing on or before the segment's own
 * starting endpoint — which, for a segment that terminates at a node, is
 * that node's border cell, so the label overwrote the border character
 * outright (issue #450: `done`'s label erasing the `Closed` state box's
 * right border in `stateDiagram-v2` sample 31). Measuring the same
 * drawing-space distance `drawTextOnLine` centers within keeps this check
 * in sync with what actually gets drawn.
 */
function calculateLineWidth(
  graph: AsciiGraph,
  line: [GridCoord, GridCoord],
): number {
  const [a, b] = line
  if (a.x === b.x) {
    return graph.columnWidth.get(a.x) ?? 0
  }
  return Math.abs(
    gridToDrawingCoord(graph, b).x - gridToDrawingCoord(graph, a).x,
  )
}
