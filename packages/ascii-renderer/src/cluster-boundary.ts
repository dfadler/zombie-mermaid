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
 * already permitted between siblings by edge-cell-styles.ts).
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
  Up,
  Down,
  Left,
  Right,
  gridCoordDirection,
  requireCardinalDirection,
  requireGridCoord,
} from './types.ts'
import { routeEdge } from './pathfinder.ts'
import { isFree } from './grid-occupancy.ts'
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
function clusterGridBox(sg: AsciiSubgraph): ClusterGridBox | null {
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
    plan.gutter,
    targetFace,
    requireCardinalDirection(vertical ? Right : Down),
  )
  if (!outside || outside.length < 2) return null

  // Deliberately not merged with the stub: for a target straight ahead the
  // stub and outside leg are collinear, and the label needs the outside leg
  // as its own segment (below the wall) rather than one long segment that
  // starts at the anchor and centres on the wall.
  const path = [face, ...outside]
  return {
    path,
    startDir,
    endDir,
    labelSegment: [path[1]!, path[2]!],
  }
}

/**
 * Decide which subgraphs engage and record their plans in
 * `graph.clusterExitPlans`. Call after node placement, column widths and
 * `assignParallelEdgeLanes` (its lane tags decide eligibility), and before
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

  const plans = new Map<AsciiSubgraph, ClusterExitPlan>()
  for (const [sg, candidates] of byCluster) {
    const plan = planOne(graph, sg, candidates, vertical)
    if (plan) plans.set(sg, plan)
  }
  if (plans.size > 0) graph.clusterExitPlans = plans
}

function planOne(
  graph: AsciiGraph,
  sg: AsciiSubgraph,
  candidates: AsciiEdge[],
  vertical: boolean,
): ClusterExitPlan | null {
  const box = clusterGridBox(sg)
  if (!box) return null

  const eligible = candidates.filter((edge) => {
    const from = edge.from.gridCoord
    const to = edge.to.gridCoord
    if (!from || !to) return false
    if (edge.parallelLane || edge.bundle || edge.from === edge.to) return false
    // The stand-in must really sit inside this cluster's box, and the
    // target outside it.
    if (!sg.nodes.includes(edge.from) || sg.nodes.includes(edge.to)) {
      return false
    }
    // Strictly past the gutter, not merely past the wall: backward and
    // sideways targets keep today's routing.
    return vertical ? to.y > box.maxY + 1 : to.x > box.maxX + 1
  })
  if (eligible.length < 2) return null

  // Every eligible edge shares one stand-in node (resolveSubgraphEndpoint
  // is deterministic per cluster) and therefore one stub.
  const anchor = eligible[0]!.from
  if (eligible.some((edge) => edge.from !== anchor)) return null

  const anchorCoord = requireGridCoord(anchor)
  const gutter: GridCoord = vertical
    ? { x: anchorCoord.x + 1, y: box.maxY + 1 }
    : { x: box.maxX + 1, y: anchorCoord.y + 1 }
  const face = gridCoordDirection(anchorCoord, vertical ? Down : Right)

  // The stub must be a clear straight run from the face to the gutter: the
  // box can contain foreign nodes, and a non-bottom anchor can have another
  // member below it.
  const stubLen = vertical ? gutter.y - face.y : gutter.x - face.x
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
    edges: new Set(eligible),
  }
  // All-or-nothing: if any edge's outside leg can't be routed, none engage.
  for (const edge of eligible) {
    if (!buildClusterExitRoute(graph, plan, edge)) return null
  }

  return plan
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
    const index = vertical ? plan.gutter.y : plan.gutter.x
    for (let i = 0; i < MAX_GUTTER_WIDENINGS; i++) {
      if (gutterClears(graph, plan, wall, vertical)) break
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
): boolean {
  const along = (c: { x: number; y: number }): number => (vertical ? c.y : c.x)
  if (along(gridToDrawingCoord(graph, plan.gutter)) <= wall) return false
  for (const edge of plan.edges) {
    const placement = edgeLabelPlacement(graph, edge)
    const last = edge.path[edge.path.length - 1]
    if (!placement || !last) continue
    const arrowCell = along(gridToDrawingCoord(graph, last)) - 1
    for (const { x, y, text } of placement) {
      const start = vertical ? y : x
      const end = vertical ? y : x + displayWidth(text) - 1
      if (start <= wall || end >= arrowCell) return false
    }
  }
  return true
}
