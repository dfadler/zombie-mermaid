/**
 * Cluster-exit sibling fans in a left-to-right flow (#2886).
 *
 * mermaid@12.3.0 gives three or more edges that leave one cluster for one
 * target ports 14.6px apart on the cluster and 4.8px apart on the target, and
 * ELK routes the outer ones round the target: the first siblings rise beside
 * the cluster, run over the target and drop beside it; the last ones dip under
 * it the same way; the middle one stays straight. The routes nest, the first
 * sibling outermost, so nothing crosses.
 *
 * `planClusterFans` finds those edges from the ELK hint (a bend beside the
 * target, `AsciiEdgeHint.bend` of 0.55 or more) and grows the grid with the
 * rows and columns they run on. `buildClusterFanRoute` draws each as a
 * six-point path, and port-offsets.ts spreads the runs of a side into their
 * own rows and columns.
 */

import type {
  AsciiEdge,
  AsciiGraph,
  AsciiNode,
  Direction,
  GridCoord,
} from './types.ts'
import { Left, Right, gridCoordDirection, requireGridCoord } from './types.ts'
import { insertGridTrack } from './cluster-boundary.ts'

/** A bend this far along the flow is beside the target (mermaid draws a stroke past it as a drop). */
const FAN_MIN_BEND = 0.55

/** Siblings needed before the outer ones go round the target. */
const FAN_MIN_SIBLINGS = 3

/** Rows (columns) between two nested runs. */
export const FAN_PITCH = 2

/** Size of a track holding `k` nested runs, with a cell clear on each side. */
const trackSize = (k: number): number => FAN_PITCH * k + 1

const bendOf = (graph: AsciiGraph, edge: AsciiEdge): number | undefined =>
  graph.edgeHints?.get(edge)?.bend

interface FanGroup {
  over: AsciiEdge[]
  under: AsciiEdge[]
  /** Other exits of the cluster, to a target further on, that drop beside it before or after the fan. */
  above: AsciiEdge[]
  below: AsciiEdge[]
  to: AsciiNode
}

/** The cluster-exit fans of `graph` (LR only), without touching the grid. */
export function findClusterFans(graph: AsciiGraph): FanGroup[] {
  if (graph.config.graphDirection !== 'LR' || !graph.edgeHints) return []
  const groups = new Map<string, AsciiEdge[]>()
  for (const edge of graph.edges) {
    if (!edge.clusterSource || edge.bundle || edge.from === edge.to) continue
    if (!graph.edgeHints.has(edge)) continue
    const key = `${edge.clusterSource.name}|${edge.to.index}`
    groups.set(key, [...(groups.get(key) ?? []), edge])
  }
  return [...groups.values()].flatMap((g) => {
    const fan = analyse(graph, g)
    return fan ? [fan] : []
  })
}

/**
 * Rows a right face needs for its ends when `node` is the stand-in of a fan: the
 * exits sit two rows apart, so the drop into the target is the longer leg, as
 * mermaid's ports (15px apart on the cluster, 5px on the target) make it.
 */
export function fanExitRows(graph: AsciiGraph, node: AsciiNode): number {
  let ends = 0
  for (const fan of findClusterFans(graph)) {
    const edges = [...fan.over, ...fan.under]
    if (edges[0]?.from !== node) continue
    ends = edges.length + fan.above.length + fan.below.length
  }
  return ends === 0 ? 0 : 2 * ends + 1
}

/** Tag the cluster-exit fans of `graph` and insert the tracks they run on. Call before any edge is routed. */
export function planClusterFans(graph: AsciiGraph): void {
  for (const edge of graph.edges) delete edge.clusterFan
  for (const fan of findClusterFans(graph)) planGroup(graph, fan)
}

function analyse(graph: AsciiGraph, group: AsciiEdge[]): FanGroup | null {
  if (group.length < FAN_MIN_SIBLINGS) return null
  const from = group[0]!.from
  const to = group[0]!.to
  if (group.some((e) => e.from !== from)) return null
  const a = requireGridCoord(from)
  const t = requireGridCoord(to)
  // The rise column needs a gutter of its own between the cluster and the target.
  if (t.x - 1 < a.x + 3) return null
  const goesRound = (e: AsciiEdge): boolean =>
    (bendOf(graph, e) ?? 0) >= FAN_MIN_BEND
  const straight = group.flatMap((e, i) => (goesRound(e) ? [] : [i]))
  let over: AsciiEdge[]
  let under: AsciiEdge[]
  if (straight.length > 0) {
    const first = straight[0]!
    const last = straight[straight.length - 1]!
    // A stroke past the straight ones' span would have to cross them.
    if (group.slice(first, last + 1).some(goesRound)) return null
    over = group.slice(0, first)
    under = group.slice(last + 1)
  } else {
    const half = Math.ceil(group.length / 2)
    over = group.slice(0, half)
    under = group.slice(half)
  }
  if (over.length + under.length < 2) return null

  // Another exit of the cluster, to a target further on, drops beside the
  // cluster before any of the fan's, so the fan's rises give way to it: below
  // the fan for the under siblings, above it for the over ones.
  const sg = group[0]!.clusterSource
  const others = graph.edges.filter(
    (e) =>
      e.clusterSource === sg &&
      !group.includes(e) &&
      e.from === from &&
      !e.bundle &&
      e.to !== to &&
      graph.edgeHints!.has(e) &&
      !goesRound(e) &&
      requireGridCoord(e.to).x > a.x + 3,
  )
  const index = (e: AsciiEdge): number => graph.edges.indexOf(e)
  const firstIdx = index(group[0]!)
  const lastIdx = index(group[group.length - 1]!)
  return {
    over,
    under,
    to,
    below: others.filter((e) => index(e) > lastIdx),
    above: others.filter((e) => index(e) < firstIdx),
  }
}

function planGroup(graph: AsciiGraph, fan: FanGroup): void {
  const { over, under, above, below, to } = fan
  const t = requireGridCoord(to)
  const bias = (list: AsciiEdge[]): number => (list.length > 0 ? FAN_PITCH : 0)
  const k = Math.max(
    over.length + bias(above) / FAN_PITCH,
    under.length + bias(below) / FAN_PITCH,
  )
  // Under track first, so the over track's insertion does not move its index.
  if (under.length > 0) {
    insertGridTrack(graph, 'y', t.y + 3, trackSize(under.length))
  }
  if (over.length > 0) {
    insertGridTrack(graph, 'y', t.y, trackSize(over.length))
  }
  // A drop column just before the target; the old gutter column becomes the rise column.
  insertGridTrack(graph, 'x', t.x, trackSize(k))
  // And a track between the two, which no route turns in: a label on a run widens
  // it, leaving the rise beside the cluster and the drop beside the target.
  insertGridTrack(graph, 'x', t.x, 1)
  const rise = t.x - 1
  // The cluster's wall takes the track's second cell, and no rise runs on it.
  graph.columnWidth.set(rise, trackSize(k) + 2)

  over.forEach((edge, slot) => {
    edge.clusterFan = {
      side: 'over',
      slot,
      count: over.length,
      bias: bias(above),
    }
  })
  // The last sibling is the outermost under the target.
  under.forEach((edge, i) => {
    edge.clusterFan = {
      side: 'under',
      slot: under.length - 1 - i,
      count: under.length,
      bias: bias(below),
    }
  })
  for (const e of [...above, ...below]) {
    e.clusterFan = { side: 'beside', slot: 0, count: 1, bias: 0 }
  }
}

export interface ClusterFanRoute {
  path: GridCoord[]
  startDir: Direction
  endDir: Direction
  /** The run along the target, where the label goes. */
  labelSegment: [GridCoord, GridCoord]
}

/** The six-point route of a tagged fan edge, from the grid as `planClusterFans` left it. */
export function buildClusterFanRoute(
  graph: AsciiGraph,
  edge: AsciiEdge,
): ClusterFanRoute | null {
  const fan = edge.clusterFan
  if (!fan) return null
  const a = requireGridCoord(edge.from)
  const t = requireGridCoord(edge.to)
  const from = gridCoordDirection(a, Right)
  const to = gridCoordDirection(t, Left)
  const rise = t.x - 3
  const drop = t.x - 1
  if (fan.side === 'beside') {
    const to = gridCoordDirection(requireGridCoord(edge.to), Left)
    const path: GridCoord[] = [
      from,
      { x: rise, y: from.y },
      { x: rise, y: to.y },
      to,
    ]
    return {
      path,
      startDir: Right,
      endDir: Left,
      labelSegment: [path[2]!, path[3]!],
    }
  }
  const row = fan.side === 'over' ? t.y - 1 : t.y + 3
  if (
    rise <= from.x ||
    !graph.rowHeight.has(row) ||
    !graph.columnWidth.has(drop)
  ) {
    return null
  }
  const path: GridCoord[] = [
    from,
    { x: rise, y: from.y },
    { x: rise, y: row },
    { x: drop, y: row },
    { x: drop, y: to.y },
    to,
  ]
  return {
    path,
    startDir: Right,
    endDir: Left,
    labelSegment: [path[2]!, path[3]!],
  }
}
