import type {
  PositionedGraph,
  PositionedNode,
  Point,
} from '@zombie-mermaid/core'

/** Shapes whose outline is not their box face, so the end is left where it is. */
const CURVED = new Set([
  'diamond',
  'circle',
  'doublecircle',
  'small-circle',
  'state-start',
  'state-end',
])

const within = (v: number, from: number, length: number): number =>
  Math.min(Math.max(v, from), from + length)

/**
 * Pull an edge's end back onto its node's face, when the segment it ends in is
 * straight and square: the end moves along the face, and the bend next to it
 * moves with it (`next`, a copy) so the segment stays straight.
 */
function clampEnd(end: Point, next: Point, node: PositionedNode): void {
  if (end.x === next.x) {
    end.x = next.x = within(end.x, node.x, node.width)
  } else if (end.y === next.y) {
    end.y = next.y = within(end.y, node.y, node.height)
  }
}

/**
 * A two-point edge has no bend to carry a clamped end, so the end moves alone
 * and the edge gets a jog halfway: it leaves the face square and meets the
 * other end square, as the layout's own bends do. The other end may sit on a
 * curved outline and must not move.
 */
function clampTwoPoints(
  [a, b]: Point[],
  source: PositionedNode,
  target: PositionedNode,
): Point[] | undefined {
  const vertical = a!.x === b!.x
  if (!vertical && a!.y !== b!.y) return undefined
  const key = vertical ? 'x' : 'y'
  const size = vertical ? 'width' : 'height'
  const to = (p: Point, n: PositionedNode): number =>
    CURVED.has(n.shape) ? p[key] : within(p[key], n[key], n[size])
  const from = to(a!, source)
  const end = to(b!, target)
  const mid = (vertical ? a!.y + b!.y : a!.x + b!.x) / 2
  const at = (c: number, along: number): Point =>
    vertical ? { x: c, y: along } : { x: along, y: c }
  const alongA = vertical ? a!.y : a!.x
  const alongB = vertical ? b!.y : b!.x
  if (from === end) return [at(from, alongA), at(end, alongB)]
  return [at(from, alongA), at(from, mid), at(end, mid), at(end, alongB)]
}

/**
 * Pull each edge's ends back onto their nodes' faces. Without bundling, the
 * compound layout can leave an end a few px past the box's corner (the box was
 * widened after the edge was routed, or `openRoom` moved the edge and not a
 * box that straddles its cut). Returns a new graph; the input is not changed.
 */
export function clampEdgeEnds(graph: PositionedGraph): PositionedGraph {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]))
  const edges = graph.edges.map((e) => {
    const source = nodes.get(e.source)
    const target = nodes.get(e.target)
    const n = e.points.length
    if (n < 2 || !source || !target) return e
    if (n === 2) {
      if (CURVED.has(source.shape) && CURVED.has(target.shape)) return e
      const points = clampTwoPoints(e.points, source, target)
      return points ? { ...e, points } : e
    }
    const p = e.points.map((q) => ({ ...q }))
    if (!CURVED.has(source.shape)) clampEnd(p[0]!, p[1]!, source)
    if (!CURVED.has(target.shape)) clampEnd(p[n - 1]!, p[n - 2]!, target)
    return { ...e, points: p }
  })
  return { ...graph, edges }
}
