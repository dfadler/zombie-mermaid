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
    const crossF = gb.f1 + WALL_GAP
    if (crossF > start.f - MIN_SOURCE_RUN) continue

    const targetC = (t.c0 + t.c1) / 2
    const route: FlowPoint[] = [
      start,
      { f: crossF, c: start.c },
      { f: crossF, c: targetC },
      { f: t.f1, c: targetC },
    ]

    // Keep ELK's route unless the new one is clear of every other node.
    const blockers = nodes
      .filter((n) => n.id !== source.id && n.id !== target.id)
      .map(axes.box)
    const clear = route.every((p, i) => {
      const next = route[i + 1]
      if (!next) return true
      return !blockers.some((b) => segmentHitsBox(p, next, b))
    })
    if (!clear) continue

    edge.points = route.map(axes.toPoint)
    if (edge.label) {
      // On the cross run, a quarter of the way from the source end: the middle
      // of the run is where this edge usually crosses the edge leaving the
      // subgraph, and a label there would sit on top of that edge.
      edge.labelPosition = axes.toPoint({
        f: crossF,
        c: start.c + (targetC - start.c) * LABEL_RUN_FRACTION,
      })
    }
  }
}
