/**
 * Cluster-boundary edge exits (#1148, fixing #1135 and #1156).
 *
 * The converter redirects an edge addressed from a subgraph id (`Processing
 * --> Done`) to one stand-in member node, so by routing time two edges that
 * leave the same cluster look like two ordinary edges from that node — and
 * each is routed independently by shortest path. With targets at different
 * offsets, one leaves through the cluster's flow-side wall and another
 * through the stand-in node's side, punching through the cluster's
 * interior. Real mermaid clips every such edge to the cluster's own
 * boundary instead.
 *
 * This module gives those edges a shared shape: a straight stub from the
 * stand-in node's flow-side face, across the cluster's wall, to a gutter
 * cell just past it; then an ordinary routed leg from the gutter to the
 * target. All exits of one cluster share the stub (same-style overlap is
 * already permitted between siblings by edge-cell-styles.ts). The shared stub
 * is the *routed* shape; draw-arrows.ts then starts each exit at its own cell
 * on the wall (`exitLandings`, #1182), so occupancy is unchanged.
 *
 * A cluster engages only when 2+ of its outgoing edges are eligible, and
 * all-or-nothing, so a single-exit cluster (and every graph without
 * subgraph-addressed edges) takes the untouched routing path and renders
 * byte for byte as before.
 *
 * Everything here works in grid coordinates: the drawing-space subgraph box
 * is computed after routing (it depends on column widths routing itself
 * changes) and `ensureSubgraphSpacing` only ever moves a top or left wall,
 * never the bottom/right walls exits cross. See
 * docs/decisions/cluster-exit-anchoring-1148-prerequisites-1164-1165.md.
 */

import type {
  AsciiEdge,
  AsciiGraph,
  AsciiSubgraph,
  ClusterExitPlan,
  ClusterGridBox,
  Direction,
  GridCoord,
} from './types.ts'
import {
  exitGutter,
  Up,
  Down,
  Left,
  Right,
  gridCoordDirection,
  gridKey,
  requireCardinalDirection,
  requireGridCoord,
} from './types.ts'
import { routeEdge, mergePath } from './pathfinder.ts'
import { isFree, pathCells } from './grid-occupancy.ts'
import { interiorCellsClearOfNodes } from './edge-routing.ts'
import { gridToDrawingCoord } from './grid.ts'
import { edgeLabelPlacement } from './draw-arrows.ts'
import { displayWidth } from './display-width.ts'

/** Same shape as edge-routing.ts's ParallelLaneRoute, plus the directions. */
export interface ClusterExitRoute {
  path: GridCoord[]
  startDir: Direction
  endDir: Direction
  /** First segment lying entirely outside the cluster — where the label goes. */
  labelSegment: [GridCoord, GridCoord]
}

/** Grid-space extent of a subgraph's nodes, or null for an empty cluster. */
export function clusterGridBox(sg: AsciiSubgraph): ClusterGridBox | null {
  let box: ClusterGridBox | null = null
  for (const node of sg.nodes) {
    const gc = node.gridCoord
    if (!gc) continue
    if (!box) {
      box = { minX: gc.x, minY: gc.y, maxX: gc.x + 2, maxY: gc.y + 2 }
      continue
    }
    box.minX = Math.min(box.minX, gc.x)
    box.minY = Math.min(box.minY, gc.y)
    box.maxX = Math.max(box.maxX, gc.x + 2)
    box.maxY = Math.max(box.maxY, gc.y + 2)
  }
  return box
}

/**
 * Compute the route for one engaged edge from its cluster's plan, or null
 * when its outside leg can't be routed (the caller then falls back to
 * ordinary routing for this edge).
 *
 * The stub was validated once, in `planClusterExits`. Only the outside leg
 * is recomputed here, so a style-conflict reroute (`grid.ts`'s
 * `rerouteAroundStyleConflicts`, which re-invokes `determinePath` with
 * extra cells temporarily blocked) can steer it around the conflict while
 * keeping the cluster shape.
 */
export function buildClusterExitRoute(
  graph: AsciiGraph,
  plan: ClusterExitPlan,
  edge: AsciiEdge,
): ClusterExitRoute | null {
  const vertical = graph.config.graphDirection !== 'LR'
  const startDir = vertical ? Down : Right
  const endDir = vertical ? Up : Left
  const face = gridCoordDirection(requireGridCoord(plan.anchor), startDir)
  const targetFace = gridCoordDirection(requireGridCoord(edge.to), endDir)

  // Horizontal-first (TD) / vertical-first (LR): fan out along the gutter,
  // then run straight into the target's entry face.
  const outside = routeEdge(
    graph,
    exitGutter(plan, edge),
    targetFace,
    requireCardinalDirection(vertical ? Right : Down),
  )
  if (!outside || outside.length < 2) return null

  // Deliberately not merged with the stub: for a target straight ahead the
  // stub and outside leg are collinear, and the label needs the outside leg
  // as its own segment (below the wall) rather than one long segment that
  // starts at the anchor and centres on the wall.
  const path = [face, ...outside]
  // Beside a lane group (#1182) the shared fan-out run also carries the
  // lane siblings' drops, so a label centred on it would read as naming
  // them too. Put each exit's label on its own final leg instead. Plans
  // without a lane group keep the first outside segment.
  const own = planHasLaneGroup(plan)
  return {
    path,
    startDir,
    endDir,
    labelSegment: own
      ? [path[path.length - 2]!, path[path.length - 1]!]
      : [path[1]!, path[2]!],
  }
}

/** Shape of an edge entering a cluster; see `buildClusterEntryRoute`. */
export interface ClusterEntryRoute {
  path: GridCoord[]
  startDir: Direction
  endDir: Direction
}

/**
 * Route an edge addressed to a subgraph id (`Y --> Sub`) to the cluster's
 * flow-side wall rather than on to the entry member inside it, as real
 * mermaid does. The path runs from the source's flow-side face to a gutter
 * cell in the row (column) just outside the wall, in the source's own
 * column (row) clamped into the cluster's span; drawing then stops the
 * arrow at the wall (`drawPath`'s end override).
 *
 * Null leaves the edge on ordinary routing: no cluster, a source that is
 * inside it, beside it, or past it, a bundled edge, or a gutter cell that
 * isn't free or reachable.
 */
export function buildClusterEntryRoute(
  graph: AsciiGraph,
  edge: AsciiEdge,
): ClusterEntryRoute | null {
  const sg = edge.clusterTarget
  if (!sg || edge.bundle || edge.from === edge.to) return null
  const box = clusterGridBox(sg)
  const from = edge.from.gridCoord
  if (!box || !from) return null
  if (sg.nodes.includes(edge.from) || !sg.nodes.includes(edge.to)) return null

  const vertical = graph.config.graphDirection !== 'LR'
  // The gutter row (column) must lie strictly past the source's block.
  if (vertical ? from.y + 2 >= box.minY - 1 : from.x + 2 >= box.minX - 1) {
    return null
  }

  const clamp = (v: number, lo: number, hi: number): number =>
    Math.min(Math.max(v, lo), hi)
  const gutter: GridCoord = vertical
    ? { x: clamp(from.x + 1, box.minX + 1, box.maxX - 1), y: box.minY - 1 }
    : { x: box.minX - 1, y: clamp(from.y + 1, box.minY + 1, box.maxY - 1) }
  if (!isFree(graph.grid, gutter)) return null

  const startDir = vertical ? Down : Right
  const endDir = vertical ? Up : Left
  const face = gridCoordDirection(from, startDir)
  const path = routeEdge(
    graph,
    face,
    gutter,
    requireCardinalDirection(startDir),
  )
  if (!path || path.length < 2) return null
  return { path, startDir, endDir }
}

/** Whether any exit in `plan` is a parallel-lane sibling (#329, #1182). */
export function planHasLaneGroup(plan: ClusterExitPlan): boolean {
  for (const edge of plan.edges) if (edge.parallelLane) return true
  return false
}

/**
 * Decide which subgraphs engage and record their plans in
 * `graph.clusterExitPlans`. Call after node placement, column widths and
 * `assignParallelEdgeLanes` (its lane tags group the siblings that join a plan whole), and before
 * the per-edge routing loop.
 */
export function planClusterExits(graph: AsciiGraph): void {
  const vertical = graph.config.graphDirection !== 'LR'
  const byCluster = new Map<AsciiSubgraph, AsciiEdge[]>()
  for (const edge of graph.edges) {
    const sg = edge.clusterSource
    if (!sg) continue
    const list = byCluster.get(sg)
    if (list) list.push(edge)
    else byCluster.set(sg, [edge])
  }

  // A lane group may ask for a gutter track the layout doesn't have (a
  // target against the layout edge, or a fourth sibling needing its own
  // track). The track is inserted and every plan rebuilt, because the
  // insertion shifts coordinates the earlier plans captured (#1253).
  for (let attempt = 0; attempt <= MAX_TRACK_INSERTIONS; attempt++) {
    const plans = new Map<AsciiSubgraph, ClusterExitPlan>()
    let insertAt: { at: number; flow: boolean } | null = null
    for (const [sg, candidates] of byCluster) {
      const result = planOne(graph, sg, candidates, vertical)
      if (result && 'at' in result) {
        insertAt = result
        break
      }
      if (result) plans.set(sg, result)
    }
    if (insertAt === null || attempt === MAX_TRACK_INSERTIONS) {
      if (plans.size > 0) graph.clusterExitPlans = plans
      // A staircase (#1331) steps one slim track at a time: the first track
      // takes the same slim size as the ones inserted after it
      // (`widenClusterGutters` still grows it to clear the wall).
      const sizes = vertical ? graph.rowHeight : graph.columnWidth
      for (const plan of plans.values()) {
        if (plan.gutters && new Set(plan.gutters.values()).size > 1) {
          sizes.set(vertical ? plan.gutter.y : plan.gutter.x, STAIR_TRACK)
        }
      }
      return
    }
    // A cross-axis track (a lane sibling's) is a column in TD; a staircase
    // track (#1331) runs along the flow, a row in TD, and stays slim.
    const axis = vertical === !insertAt.flow ? 'x' : 'y'
    insertGridTrack(
      graph,
      axis,
      insertAt.at,
      insertAt.flow
        ? STAIR_TRACK
        : vertical
          ? graph.config.paddingX
          : graph.config.paddingY,
    )
  }
}

/** Safety bound on gutter-track insertions per layout. */
const MAX_TRACK_INSERTIONS = 16

/** Size of an inserted staircase track (#1331). */
const STAIR_TRACK = 2

/**
 * Insert one empty gutter track (a column in TD, a row in LR) at index `at`,
 * shifting every node and size entry at or past it by one. Runs after node
 * placement and before any edge is routed, so nothing else holds grid
 * coordinates yet.
 */
function insertGridTrack(
  graph: AsciiGraph,
  axis: 'x' | 'y',
  at: number,
  size: number,
): void {
  const shift = (c: GridCoord): GridCoord =>
    axis === 'x'
      ? { x: c.x >= at ? c.x + 1 : c.x, y: c.y }
      : { x: c.x, y: c.y >= at ? c.y + 1 : c.y }
  for (const node of graph.nodes) {
    if (node.gridCoord) node.gridCoord = shift(node.gridCoord)
  }
  const keys = [...graph.grid.keys()]
  for (const key of keys) graph.grid.delete(key)
  for (const key of keys) {
    const [x, y] = key.split(',').map(Number)
    graph.grid.add(gridKey(shift({ x: x!, y: y! })))
  }
  const sizes = axis === 'x' ? graph.columnWidth : graph.rowHeight
  const shifted = [...sizes].filter(([index]) => index >= at)
  for (const [index] of shifted) sizes.delete(index)
  for (const [index, size] of shifted) sizes.set(index + 1, size)
  sizes.set(at, size)
}

/**
 * Plan one cluster's exits. Returns the plan, null when the cluster doesn't
 * engage, or a track index at which `planClusterExits` must insert a gutter
 * track before planning again.
 */
function planOne(
  graph: AsciiGraph,
  sg: AsciiSubgraph,
  candidates: AsciiEdge[],
  vertical: boolean,
): ClusterExitPlan | { at: number; flow: boolean } | null {
  const box = clusterGridBox(sg)
  if (!box) return null

  const routable = candidates.filter((edge) => {
    const from = edge.from.gridCoord
    const to = edge.to.gridCoord
    if (!from || !to) return false
    if (edge.bundle || edge.from === edge.to) return false
    // The stand-in must really sit inside this cluster's box, and the
    // target outside it.
    if (!sg.nodes.includes(edge.from) || sg.nodes.includes(edge.to)) {
      return false
    }
    // Strictly past the gutter, not merely past the wall: backward and
    // sideways targets keep today's routing.
    return vertical ? to.y > box.maxY + 1 : to.x > box.maxX + 1
  })

  // A parallel-lane group (same stand-in and target, #329) joins the plan
  // only whole: every sibling must be eligible, or lane routing and the
  // plan would disagree about the group (a direct `a --> T` beside
  // `S --> T` shares the group but isn't cluster-addressed). Such a group
  // keeps today's routing, as does any edge that is a lane sibling of one.
  const routableSet = new Set(routable)
  const laneGroups = new Map<Set<number>, AsciiEdge[]>()
  for (const edge of graph.edges) {
    if (!edge.parallelLane) continue
    const group = laneGroups.get(edge.parallelLane.usedOffsets)
    if (group) group.push(edge)
    else laneGroups.set(edge.parallelLane.usedOffsets, [edge])
  }
  let eligible = routable.filter((edge) => {
    if (!edge.parallelLane) return true
    return laneGroups
      .get(edge.parallelLane.usedOffsets)!
      .every((sibling) => routableSet.has(sibling))
  })
  if (eligible.length === 0) return null

  // Every eligible edge shares one stand-in node (resolveSubgraphEndpoint
  // is deterministic per cluster) and therefore one stub.
  const anchor = eligible[0]!.from
  if (eligible.some((edge) => edge.from !== anchor)) return null

  const anchorCoord = requireGridCoord(anchor)
  const gutter: GridCoord = vertical
    ? { x: anchorCoord.x + 1, y: box.maxY + 1 }
    : { x: box.maxX + 1, y: anchorCoord.y + 1 }
  const face = gridCoordDirection(anchorCoord, vertical ? Down : Right)

  // A lane group also needs a free side face on its target for each
  // sibling past the first (`clusterLaneSideRoute`); a group that can't get
  // one (three or more siblings, a target against the layout edge) keeps
  // today's routing like any other ineligible group.
  const trial: ClusterExitPlan = {
    box,
    anchor,
    gutter,
    gutters: staircase(eligible, gutter, vertical).gutters,
    edges: new Set(eligible),
  }
  const unroutable = new Set<Set<number>>()
  for (const edge of eligible) {
    const lane = edge.parallelLane
    if (lane && lane.index > 0 && !clusterLaneSideRoute(graph, trial, edge)) {
      // A sibling that only lacks a gutter track gets one inserted (#1253)
      // when the group would otherwise engage.
      const missing = laneSide(graph, trial, edge)?.insertAt
      const hasOtherExit = eligible.some(
        (other) => other.parallelLane?.usedOffsets !== lane.usedOffsets,
      )
      if (missing !== undefined && hasOtherExit) {
        return { at: missing, flow: false }
      }
      unroutable.add(lane.usedOffsets)
    }
  }
  eligible = eligible.filter(
    (edge) =>
      !edge.parallelLane || !unroutable.has(edge.parallelLane.usedOffsets),
  )

  // The 2+ threshold counts a lane group once: its siblings leave together
  // down the same trunk, so on their own they have no fan-out to organise.
  const exits = new Set<unknown>(
    eligible.map((edge) => edge.parallelLane?.usedOffsets ?? edge),
  )
  if (exits.size < 2) return null

  // Staircase bus (#1331): each exit turns off the stub on a track of its
  // own. Tracks past the first must exist and be free of nodes, else one is
  // inserted there and the plan rebuilt.
  const { gutters, rows } = staircase(eligible, gutter, vertical)
  const sizes = vertical ? graph.rowHeight : graph.columnWidth
  for (let i = 1; i < rows; i++) {
    const track = (vertical ? gutter.y : gutter.x) + i
    const occupied = graph.nodes.some((node) => {
      const at = requireGridCoord(node)
      const start = vertical ? at.y : at.x
      return start <= track && track <= start + 2
    })
    if (occupied || !sizes.has(track)) return { at: track, flow: true }
  }

  const stubLen = (vertical ? gutter.y - face.y : gutter.x - face.x) + rows - 1
  for (let i = 1; i <= stubLen; i++) {
    const cell: GridCoord = vertical
      ? { x: face.x, y: face.y + i }
      : { x: face.x + i, y: face.y }
    if (!isFree(graph.grid, cell)) return null
  }

  const plan: ClusterExitPlan = {
    box,
    anchor,
    gutter,
    gutters,
    edges: new Set(eligible),
  }
  // All-or-nothing: if any edge's outside leg can't be routed, none engage.
  for (const edge of eligible) {
    if (!buildClusterExitRoute(graph, plan, edge)) return null
  }

  return plan
}

/**
 * Staircase bus (#1331): assign each exit unit (a lane group counts once) its
 * own gutter track, so no two siblings turn on the same row (column) and each
 * label sits on its own run. Farthest target first, so a nearer exit's drop
 * never crosses a farther exit's run. `rows` is the number of tracks used.
 */
function staircase(
  eligible: AsciiEdge[],
  gutter: GridCoord,
  vertical: boolean,
): { gutters: Map<AsciiEdge, GridCoord>; rows: number } {
  const units = new Map<unknown, AsciiEdge[]>()
  for (const edge of eligible) {
    const key = edge.parallelLane?.usedOffsets ?? edge
    const unit = units.get(key)
    if (unit) unit.push(edge)
    else units.set(key, [edge])
  }
  const offset = (edges: AsciiEdge[]): number => {
    const to = requireGridCoord(edges[0]!.to)
    return vertical ? to.x + 1 - gutter.x : to.y + 1 - gutter.y
  }
  const sorted = [...units.values()].sort(
    (a, b) => Math.abs(offset(b)) - Math.abs(offset(a)),
  )
  const rows = sorted.length
  const gutters = new Map<AsciiEdge, GridCoord>()
  sorted.forEach((edges, i) => {
    const track = i
    const cell: GridCoord = vertical
      ? { x: gutter.x, y: gutter.y + track }
      : { x: gutter.x + track, y: gutter.y }
    for (const edge of edges) gutters.set(edge, cell)
  })
  return { gutters, rows }
}

/** Which target face and gutter track a lane sibling uses; see `laneSide`. */
interface LaneSide {
  lane: number
  attach: number
  dir: Direction
  /** Set when the track doesn't exist yet: insert a gutter track here first. */
  insertAt?: number
}

/**
 * The face and gutter track for lane sibling `edge` (`index` 1 takes the near
 * side of the target, 2 the far side, 3 a track of its own past the high
 * side that merges into the same face); null when no such leg is possible,
 * or `insertAt` set when it needs a gutter track the layout lacks (#1253): a
 * target against the layout edge, or the fourth sibling's own track.
 */
function laneSide(
  graph: AsciiGraph,
  plan: ClusterExitPlan,
  edge: AsciiEdge,
): LaneSide | null {
  const vertical = graph.config.graphDirection !== 'LR'
  const index = edge.parallelLane!.index
  if (index > 3) return null
  const to = requireGridCoord(edge.to)
  const origin = vertical ? to.x : to.y
  // Cross-axis position of the target's centre, and whether the gutter
  // lies on its low or high side.
  const centre = origin + 1
  const gutterCross = vertical ? plan.gutter.x : plan.gutter.y
  const high: LaneSide = {
    lane: origin + 3,
    attach: origin + 2,
    dir: vertical ? Left : Up,
  }
  const low: LaneSide = {
    lane: origin - 1,
    attach: origin,
    dir: vertical ? Right : Down,
  }
  const sizes = vertical ? graph.columnWidth : graph.rowHeight
  // Gutter at or past the target's centre: siblings 2 and 3 both stack their
  // own tracks on the high side (origin+4, origin+5), so labels read in source
  // order instead of the third sibling detouring left and back into the low face.
  const stackHigh = gutterCross >= centre
  if (index === 3 || (index === 2 && stackHigh)) {
    // Its own track just past the high gutter: free of nodes and sized, or
    // else inserted. Landing on the high face merges with the sibling there.
    const lane = origin + 4 + (stackHigh ? index - 2 : 0)
    if (lane === gutterCross) return null
    const occupied = graph.nodes.some((node) => {
      const at = requireGridCoord(node)
      const start = vertical ? at.x : at.y
      return start <= lane && lane <= start + 2
    })
    return {
      ...high,
      lane,
      insertAt: occupied || !sizes.has(lane) ? lane : undefined,
    }
  }
  const side = (gutterCross >= centre ? [high, low] : [low, high])[index - 1]!
  if (side.lane === gutterCross) return null
  // Against the layout edge the low side has no gutter track at all.
  if (side.lane < 0) return { ...side, insertAt: 0 }
  return sizes.has(side.lane) ? side : null
}

/**
 * A lane sibling's leg from the gutter cell to a face of the target that the
 * first lane (which enters the flow-side face) leaves free: in TD the
 * target's right face, then its left; in LR its bottom face, then its top.
 * The lane drops through the gutter column (row) beside the target and
 * enters that face, so the arrowhead lands one cell outside the border. The
 * ordinary lane builder instead runs its last approach along the target's
 * own border column (row), overwriting the border. Sibling `index` 1 takes
 * the near side, 2 the far side, 3 its own track on the high side; null when
 * the leg has no gutter track yet (see `laneSide`), isn't clear of other
 * nodes, or for any further sibling.
 */
export function clusterLaneSideRoute(
  graph: AsciiGraph,
  plan: ClusterExitPlan,
  edge: AsciiEdge,
): {
  path: GridCoord[]
  endDir: Direction
  labelSegment: [GridCoord, GridCoord]
} | null {
  const vertical = graph.config.graphDirection !== 'LR'
  const to = requireGridCoord(edge.to)
  const gutter = exitGutter(plan, edge)
  const side = laneSide(graph, plan, edge)
  if (!side || side.insertAt !== undefined) return null

  const path: GridCoord[] = vertical
    ? mergePath([
        gutter,
        { x: side.lane, y: gutter.y },
        { x: side.lane, y: to.y + 1 },
        { x: side.attach, y: to.y + 1 },
      ])
    : mergePath([
        gutter,
        { x: gutter.x, y: side.lane },
        { x: to.x + 1, y: side.lane },
        { x: to.x + 1, y: side.attach },
      ])
  // The leg runs through the gutter beside the target, which no node block
  // reaches in the layouts the planner produces; checked anyway so a
  // surprising layout falls back to ordinary routing instead of crossing a
  // node.
  /* v8 ignore next 5 */
  if (
    !interiorCellsClearOfNodes(graph, pathCells(path), [edge.from, edge.to])
  ) {
    return null
  }
  const labelSegment: [GridCoord, GridCoord] = vertical
    ? [
        { x: side.lane, y: gutter.y },
        { x: side.lane, y: to.y },
      ]
    : [
        { x: gutter.x, y: side.lane },
        { x: to.x, y: side.lane },
      ]
  return { path, endDir: side.dir, labelSegment }
}

/** Safety bound on one-character gutter widenings per cluster. */
const MAX_GUTTER_WIDENINGS = 64

/**
 * Widen each engaged cluster's gutter until the outside leg and its label
 * clear the cluster's drawn wall and the target's arrowhead. Returns whether
 * any column/row changed, in which case the caller must recompute drawing
 * coordinates and subgraph boxes. Call after `calculateSubgraphBoundingBoxes`.
 *
 * Measured rather than assumed, because what has to be cleared isn't fixed:
 * the wall sits 2 characters past the last node per nested box sharing that
 * edge, padding is configurable, in LR the box is also widened on the right
 * to fit a long cluster label (`calculateSubgraphBoundingBox`), and a
 * label centred on a segment beside the wall can be several characters
 * wide. The gutter lies outside the cluster's own columns/rows, so widening
 * it never changes the box being measured. A cluster whose gutter already
 * clears everything (the common case in TD at default padding) is left
 * exactly as it was.
 */
export function widenClusterGutters(graph: AsciiGraph): boolean {
  const plans = graph.clusterExitPlans
  if (!plans) return false
  const vertical = graph.config.graphDirection !== 'LR'
  let changed = false
  // Outermost first: widening an inner cluster's gutter shifts the columns
  // (rows) of any enclosing cluster's wall and gutter, so an outer plan
  // checked earlier would measure against a stale wall (#1213). Array.sort
  // is stable, so same-depth plans keep edge order.
  const ordered = [...plans].sort(
    ([a], [b]) => subgraphDepth(a) - subgraphDepth(b),
  )
  for (const [sg, plan] of ordered) {
    const wall = vertical ? sg.maxY : sg.maxX
    const sizes = vertical ? graph.rowHeight : graph.columnWidth
    const first = vertical ? plan.gutter.y : plan.gutter.x
    // The labels' and arrowheads' room is the last staircase track's (#1331);
    // the wall's is the first's.
    const tracks = new Set(
      [...(plan.gutters?.values() ?? [])].map((c) => (vertical ? c.y : c.x)),
    )
    const last = Math.max(first, ...tracks)
    for (let i = 0; i < MAX_GUTTER_WIDENINGS; i++) {
      const clear = gutterClears(graph, plan, wall, vertical)
      if (clear === true) break
      const index = clear === 'wall' ? first : last
      sizes.set(index, (sizes.get(index) ?? 0) + 1)
      changed = true
    }
  }
  return changed
}

/** Number of enclosing subgraphs (`parent` links) above `sg`. */
function subgraphDepth(sg: AsciiSubgraph): number {
  let depth = 0
  for (let p = sg.parent; p; p = p.parent) depth++
  return depth
}

/**
 * Whether, along the flow axis: the gutter's centre is past `wall`; and each
 * labeled edge's text starts past the wall and ends at least one cell before
 * the arrowhead (which sits one cell before the target's entry face).
 */
function gutterClears(
  graph: AsciiGraph,
  plan: ClusterExitPlan,
  wall: number,
  vertical: boolean,
): true | 'wall' | 'leg' {
  const along = (c: { x: number; y: number }): number => (vertical ? c.y : c.x)
  if (along(gridToDrawingCoord(graph, plan.gutter)) <= wall) return 'wall'
  for (const edge of plan.edges) {
    const placement = edgeLabelPlacement(graph, edge)
    const last = edge.path[edge.path.length - 1]
    if (!placement || !last) continue
    const arrowCell = along(gridToDrawingCoord(graph, last)) - 1
    for (const { x, y, text } of placement) {
      const start = vertical ? y : x
      const end = vertical ? y : x + displayWidth(text) - 1
      if (start <= wall) return 'wall'
      if (end >= arrowCell) return 'leg'
    }
  }
  return true
}
