/**
 * Land an edge on a diamond's vertex, not on its slope.
 *
 * ELK treats a diamond as a rectangle and aims an incoming edge at a port on
 * the bounding box's face, which is usually off the face's centre. Clipping
 * then drops that off-centre line onto the diamond's slanted side, so the
 * arrowhead lands on the slope. mermaid.js aims every edge at the node's
 * centre, so an edge that arrives straight on lands on the vertex (#1239).
 *
 * This pass moves the last two points of such an edge onto the face's centre
 * line: the final straight run and the bend before it. The run before the bend
 * is a jog, so it just gets longer or shorter. Edges it can't move cleanly
 * are left as ELK drew them.
 */

import type {
  Point,
  PositionedEdge,
  PositionedNode,
} from '@zombie-mermaid/core'

/** Clearance kept from other nodes along the moved route, in px. */
const NODE_CLEARANCE = 2

/** Smallest remaining final run, in px, so the arrowhead still fits. */
const MIN_FINAL_RUN = 10

/** Offsets within this many px of the centre line are already on the vertex. */
const ON_CENTRE = 1

type Face = 'top' | 'bottom' | 'left' | 'right'

function faceOf(
  node: PositionedNode,
  last: Point,
  prev: Point,
): { face: Face; vertical: boolean } | undefined {
  const dx = Math.abs(last.x - prev.x)
  const dy = Math.abs(last.y - prev.y)
  const cx = node.x + node.width / 2
  const cy = node.y + node.height / 2
  if (dx <= ON_CENTRE && dy > ON_CENTRE) {
    return { face: prev.y < cy ? 'top' : 'bottom', vertical: true }
  }
  if (dy <= ON_CENTRE && dx > ON_CENTRE) {
    return { face: prev.x < cx ? 'left' : 'right', vertical: false }
  }
  return undefined
}

function segmentHitsNode(a: Point, b: Point, n: PositionedNode): boolean {
  return (
    Math.max(a.x, b.x) > n.x - NODE_CLEARANCE &&
    Math.min(a.x, b.x) < n.x + n.width + NODE_CLEARANCE &&
    Math.max(a.y, b.y) > n.y - NODE_CLEARANCE &&
    Math.min(a.y, b.y) < n.y + n.height + NODE_CLEARANCE
  )
}

/**
 * Move each single incoming edge that meets a diamond straight on, but off its
 * centre line, onto the vertex. Mutates `edges`.
 */
export function snapEdgesToDiamondVertices(
  edges: PositionedEdge[],
  nodes: PositionedNode[],
): void {
  const nodeById = new Map(nodes.map((n) => [n.id, n]))

  // Which face each edge lands on, so a face that several edges share keeps
  // ELK's spread instead of stacking them all on one vertex.
  const landing = new Map<PositionedEdge, { face: Face; vertical: boolean }>()
  const perFace = new Map<string, number>()
  for (const edge of edges) {
    const target = nodeById.get(edge.target)
    const n = edge.points.length
    if (!target || target.shape !== 'diamond' || n < 2) continue
    const f = faceOf(target, edge.points[n - 1]!, edge.points[n - 2]!)
    if (!f) continue
    landing.set(edge, f)
    const key = `${target.id}:${f.face}`
    perFace.set(key, (perFace.get(key) ?? 0) + 1)
  }
  // Edges leaving the diamond from that face share it too.
  for (const edge of edges) {
    const source = nodeById.get(edge.source)
    if (!source || source.shape !== 'diamond' || edge.points.length < 2)
      continue
    const f = faceOf(source, edge.points[0]!, edge.points[1]!)
    if (!f) continue
    const key = `${source.id}:${f.face}`
    perFace.set(key, (perFace.get(key) ?? 0) + 1)
  }

  for (const [edge, { face, vertical }] of landing) {
    const target = nodeById.get(edge.target)!
    if ((perFace.get(`${target.id}:${face}`) ?? 0) > 1) continue

    const pts = edge.points
    const n = pts.length
    // Needs the jog before the final run: three points, with the run before
    // the last bend perpendicular to the final run.
    if (n < 3) continue
    const last = pts[n - 1]!
    const bend = pts[n - 2]!
    const before = pts[n - 3]!

    const centre = vertical
      ? target.x + target.width / 2
      : target.y + target.height / 2
    const current = vertical ? last.x : last.y
    if (Math.abs(current - centre) <= ON_CENTRE) continue

    const jogIsPerpendicular = vertical
      ? Math.abs(before.y - bend.y) <= ON_CENTRE &&
        Math.abs(before.x - bend.x) > ON_CENTRE
      : Math.abs(before.x - bend.x) <= ON_CENTRE &&
        Math.abs(before.y - bend.y) > ON_CENTRE
    if (!jogIsPerpendicular) continue

    const newBend: Point = vertical
      ? { x: centre, y: bend.y }
      : { x: bend.x, y: centre }
    const newLast: Point = vertical
      ? { x: centre, y: last.y }
      : { x: last.x, y: centre }

    // The final run must keep room for the arrowhead.
    const run = vertical
      ? Math.abs(newLast.y - newBend.y)
      : Math.abs(newLast.x - newBend.x)
    if (run < MIN_FINAL_RUN) continue

    // The moved route must stay clear of every other node.
    const source = nodeById.get(edge.source)
    const blockers = nodes.filter((o) => o !== target && o !== source)
    if (
      blockers.some(
        (o) =>
          segmentHitsNode(before, newBend, o) ||
          segmentHitsNode(newBend, newLast, o),
      )
    ) {
      continue
    }

    pts[n - 2] = newBend
    pts[n - 1] = newLast
  }
}
