/**
 * Route a back edge into a subgraph from below instead of around the top.
 *
 * An edge from a node past the end of a subgraph back to a node inside it
 * (`F -->|No| D` where `D` is in a subgraph that feeds `F`) points against the
 * flow. ELK routes it up the side, over the upstream end of the whole subgraph
 * and back down into the target, which is a long loop that also crosses the
 * subgraph's title. This pass replaces that loop with a short route: up from
 * the source to just past the subgraph's downstream wall, across, and up
 * through the wall into the target's downstream face.
 *
 * The pass is deliberately narrow. It only touches an edge that actually makes
 * the loop (a point upstream of the subgraph's upstream end) and only when the
 * new route is clear of every other node; otherwise ELK's route is kept.
 */

import type {
  Direction,
  PositionedEdge,
  PositionedGroup,
  PositionedNode,
  Point,
} from '@zombie-mermaid/core'

/** Space kept between the subgraph's downstream wall and the new cross run, in px. */
const WALL_GAP = 14

/** Clearance kept from other nodes along the new route, in px. */
const NODE_CLEARANCE = 4

/**
 * Smallest run kept between the source and the cross run, so the route
 * doesn't fold back onto the source itself.
 */
const MIN_SOURCE_RUN = 12

/** How far along the cross run, from the source end, the edge label goes (0-1). */
const LABEL_RUN_FRACTION = 0.25

/**
 * A point in flow space: `f` grows along the flow (downstream), `c` across it.
 * Lets the pass be written once for every direction.
 */
interface FlowPoint {
  f: number
  c: number
}

interface FlowBox {
  f0: number
  f1: number
  c0: number
  c1: number
}

interface FlowAxes {
  toFlow: (p: Point) => FlowPoint
  toPoint: (p: FlowPoint) => Point
  box: (b: { x: number; y: number; width: number; height: number }) => FlowBox
}

function flowAxes(direction: Direction): FlowAxes {
  const vertical =
    direction === 'TD' || direction === 'TB' || direction === 'BT'
  const sign = direction === 'BT' || direction === 'RL' ? -1 : 1
  const toFlow = (p: Point): FlowPoint =>
    vertical ? { f: sign * p.y, c: p.x } : { f: sign * p.x, c: p.y }
  const toPoint = (p: FlowPoint): Point =>
    vertical ? { x: p.c, y: sign * p.f } : { x: sign * p.f, y: p.c }
  const box = (b: {
    x: number
    y: number
    width: number
    height: number
  }): FlowBox => {
    const a = toFlow({ x: b.x, y: b.y })
    const z = toFlow({ x: b.x + b.width, y: b.y + b.height })
    return {
      f0: Math.min(a.f, z.f),
      f1: Math.max(a.f, z.f),
      c0: Math.min(a.c, z.c),
      c1: Math.max(a.c, z.c),
    }
  }
  return { toFlow, toPoint, box }
}

function flattenGroups(groups: PositionedGroup[]): PositionedGroup[] {
  return groups.flatMap((g) => [g, ...flattenGroups(g.children)])
}

/** Whether the segment a-b (axis-aligned in flow space) passes through `box`, grown by the clearance. */
function segmentHitsBox(a: FlowPoint, b: FlowPoint, box: FlowBox): boolean {
  return (
    Math.max(a.f, b.f) > box.f0 - NODE_CLEARANCE &&
    Math.min(a.f, b.f) < box.f1 + NODE_CLEARANCE &&
    Math.max(a.c, b.c) > box.c0 - NODE_CLEARANCE &&
    Math.min(a.c, b.c) < box.c1 + NODE_CLEARANCE
  )
}

interface Candidate {
  route: FlowPoint[]
  label: FlowPoint
}

function pathLength(route: FlowPoint[]): number {
  return route.reduce(
    (sum, p, i) =>
      i === 0
        ? 0
        : sum +
          Math.abs(p.f - route[i - 1]!.f) +
          Math.abs(p.c - route[i - 1]!.c),
    0,
  )
}

/** Sign of the turn a-b-c in flow space. */
function turn(a: FlowPoint, b: FlowPoint, c: FlowPoint): number {
  return (b.f - a.f) * (c.c - a.c) - (b.c - a.c) * (c.f - a.f)
}

/** Whether the segments a-b and c-d properly cross (touching ends don't count). */
function segmentsCross(
  a: FlowPoint,
  b: FlowPoint,
  c: FlowPoint,
  d: FlowPoint,
): boolean {
  return turn(a, b, c) * turn(a, b, d) < 0 && turn(c, d, a) * turn(c, d, b) < 0
}

/** How many times `route` crosses the polylines in `others`. */
function countCrossings(route: FlowPoint[], others: FlowPoint[][]): number {
  let n = 0
  for (let i = 0; i + 1 < route.length; i++) {
    for (const other of others) {
      for (let j = 0; j + 1 < other.length; j++) {
        if (segmentsCross(route[i]!, route[i + 1]!, other[j]!, other[j + 1]!))
          n++
      }
    }
  }
  return n
}

/**
 * Replace each back edge that loops around the upstream end of a subgraph
 * with a short route entering through the subgraph's downstream wall.
 * Mutates `edges`; edges that don't qualify are left alone.
 */
export function routeBackEdgesIntoGroups(
  edges: PositionedEdge[],
  groups: PositionedGroup[],
  nodes: PositionedNode[],
  direction: Direction,
): void {
  const axes = flowAxes(direction)
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const allGroups = flattenGroups(groups)

  for (const edge of edges) {
    const source = nodeById.get(edge.source)
    const target = nodeById.get(edge.target)
    if (!source || !target || edge.points.length < 2) continue

    const s = axes.box(source)
    const t = axes.box(target)

    // The innermost group that holds the target but not the source.
    const group = allGroups
      .filter((g) => {
        const gb = axes.box(g)
        const holds = (b: FlowBox): boolean =>
          b.f0 >= gb.f0 && b.f1 <= gb.f1 && b.c0 >= gb.c0 && b.c1 <= gb.c1
        return holds(t) && !holds(s)
      })
      .sort((a, b) => a.width * a.height - b.width * b.height)[0]
    if (!group) continue

    const gb = axes.box(group)
    const pts = edge.points.map(axes.toFlow)

    // Only an edge that loops: the source is wholly past the subgraph's
    // downstream end, and the route goes upstream of its upstream end.
    if (s.f0 < gb.f1) continue
    if (!pts.some((p) => p.f < gb.f0)) continue

    const start = pts[0]!
    const targetC = (t.c0 + t.c1) / 2
    const candidates: Candidate[] = []

    // Out of the source's side, across to the target's column, then straight
    // up into the target. Only possible when the target's column is clear of
    // the source, and the cleanest route when it applies: one bend, and it
    // stays out of the way of the edge that leaves the subgraph.
    const sideC = targetC < s.c0 ? s.c0 : targetC > s.c1 ? s.c1 : undefined
    const midF = (s.f0 + s.f1) / 2
    if (sideC !== undefined && midF > t.f1 + MIN_SOURCE_RUN) {
      candidates.push({
        route: [
          { f: midF, c: sideC },
          { f: midF, c: targetC },
          { f: t.f1, c: targetC },
        ],
        label: { f: (gb.f1 + midF) / 2, c: targetC },
      })
    }

    // Up from the source to just past the wall, across, and up into the target.
    const crossF = gb.f1 + WALL_GAP
    if (crossF <= start.f - MIN_SOURCE_RUN) {
      candidates.push({
        route: [
          start,
          { f: crossF, c: start.c },
          { f: crossF, c: targetC },
          { f: t.f1, c: targetC },
        ],
        // A quarter of the way along the cross run from the source end: the
        // middle of the run is where it usually crosses the edge leaving the
        // subgraph, and a label there would sit on top of that edge.
        label: {
          f: crossF,
          c: start.c + (targetC - start.c) * LABEL_RUN_FRACTION,
        },
      })
    }

    // Keep ELK's route unless a new one is clear of every other node. Of the
    // clear ones, take the one that crosses the fewest other edges.
    const blockers = nodes
      .filter((n) => n.id !== source.id && n.id !== target.id)
      .map(axes.box)
    const others = edges
      .filter((e) => e !== edge)
      .map((e) => e.points.map(axes.toFlow))
    const best = candidates
      .filter(({ route }) =>
        route.every((p, i) => {
          const next = route[i + 1]
          return !next || !blockers.some((b) => segmentHitsBox(p, next, b))
        }),
      )
      .map((c) => ({
        c,
        crossings: countCrossings(c.route, others),
        length: pathLength(c.route),
      }))
      .sort((a, b) => a.crossings - b.crossings || a.length - b.length)[0]
    if (!best) continue

    edge.points = best.c.route.map(axes.toPoint)
    if (edge.label) edge.labelPosition = axes.toPoint(best.c.label)
  }
}
