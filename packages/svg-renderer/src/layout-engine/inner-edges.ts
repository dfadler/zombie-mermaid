/**
 * Routes an edge between two members of a subgraph through the inside of its
 * box.
 *
 * `compound-flat.ts` keeps outsiders out of a box with invisible spine nodes in
 * the layers where the subgraph has no member. An edge from one member to
 * another that spans such a layer has to get past the spine, and ELK sends it
 * round the outside, which drags its end node, and so the box, sideways. These
 * edges are left out of the layout and drawn afterwards by `routeInnerEdge`,
 * which runs them down a channel between the members.
 *
 * Everything is worked out as (a, c): `a` along the flow, increasing with it,
 * and `c` across it. For `TD` that is (y, x); `BT` negates `a`, `LR` is (x, y).
 */

import type { Direction, Point, PositionedNode } from '@zombie-mermaid/core'

/** Room kept between a route and the nodes it passes, in px. */
const CLEARANCE = 10

/** Least distance between two routes that run side by side, in px. */
const PARALLEL_GAP = 14

/** How far an edge runs out of a node before turning, in px. */
const STUB = 14

/** Room kept between a route and the box's border, in px. */
const BORDER_INSET = 10

/** Cost of each bend, in px of extra length, so a straighter route wins. */
const BEND_COST = 24

/** Extra cost of leaving a decision by its bottom vertex, in px. */
const DECISION_STEM = 400

/** Shapes whose whole edge is a straight side an edge can leave from anywhere. */
const FLAT_SIDED = new Set(['rectangle', 'rounded', 'subroutine'])

interface Span {
  a0: number
  a1: number
  c0: number
  c1: number
}

interface Pt {
  a: number
  c: number
}

interface Frame {
  span: (box: BoxLike) => Span
  toPoint: (p: Pt) => Point
}

type BoxLike = { x: number; y: number; width: number; height: number }

function frameFor(direction: Direction): Frame {
  const vertical =
    direction === 'TD' || direction === 'TB' || direction === 'BT'
  const flip = direction === 'BT' || direction === 'RL'
  const sign = flip ? -1 : 1
  return {
    span: (b) => {
      const [p0, p1] = vertical ? [b.y, b.y + b.height] : [b.x, b.x + b.width]
      const a0 = sign * p0
      const a1 = sign * p1
      return {
        a0: Math.min(a0, a1),
        a1: Math.max(a0, a1),
        c0: vertical ? b.x : b.y,
        c1: vertical ? b.x + b.width : b.y + b.height,
      }
    },
    toPoint: ({ a, c }) =>
      vertical ? { x: c, y: sign * a } : { x: sign * a, y: c },
  }
}

/** Whether the segment `p`-`q` (one axis only) passes through the inside of `s`. */
function crosses(p: Pt, q: Pt, s: Span): boolean {
  const aLo = Math.min(p.a, q.a)
  const aHi = Math.max(p.a, q.a)
  const cLo = Math.min(p.c, q.c)
  const cHi = Math.max(p.c, q.c)
  return aHi > s.a0 && aLo < s.a1 && cHi > s.c0 && cLo < s.c1
}

const grow = (s: Span, by: number): Span => ({
  a0: s.a0 - by,
  a1: s.a1 + by,
  c0: s.c0 - by,
  c1: s.c1 + by,
})

/** The (a, c) of a point in `frame`. */
function toPt(frame: Frame, p: Point): Pt {
  const s = frame.span({ x: p.x, y: p.y, width: 0, height: 0 })
  return { a: s.a0, c: s.c0 }
}

/** Whether the segment `p`-`q` runs beside a segment of `path`, closer than `PARALLEL_GAP`. */
function runsAlong(p: Pt, q: Pt, path: readonly Pt[]): boolean {
  const flowwise = p.c === q.c
  for (let i = 1; i < path.length; i++) {
    const r = path[i - 1]!
    const t = path[i]!
    if ((r.c === t.c) !== flowwise) continue
    if (flowwise) {
      const apart = Math.abs(p.c - r.c)
      const shared =
        Math.min(Math.max(p.a, q.a), Math.max(r.a, t.a)) -
        Math.max(Math.min(p.a, q.a), Math.min(r.a, t.a))
      if (apart < PARALLEL_GAP && shared > 0) return true
    } else {
      const apart = Math.abs(p.a - r.a)
      const shared =
        Math.min(Math.max(p.c, q.c), Math.max(r.c, t.c)) -
        Math.max(Math.min(p.c, q.c), Math.min(r.c, t.c))
      if (apart < PARALLEL_GAP && shared > 0) return true
    }
  }
  return false
}

/** The path with repeated points and points in the middle of a straight run removed. */
function simplify(path: Pt[]): Pt[] {
  const out: Pt[] = []
  for (const p of path) {
    const last = out[out.length - 1]
    if (last && last.a === p.a && last.c === p.c) continue
    out.push(p)
  }
  for (let i = out.length - 2; i > 0; i--) {
    const prev = out[i - 1]!
    const here = out[i]!
    const next = out[i + 1]!
    const straight =
      (prev.a === here.a && here.a === next.a) ||
      (prev.c === here.c && here.c === next.c)
    if (straight) out.splice(i, 1)
  }
  return out
}

const length = (path: Pt[]): number => {
  let total = 0
  for (let i = 1; i < path.length; i++) {
    total +=
      Math.abs(path[i]!.a - path[i - 1]!.a) +
      Math.abs(path[i]!.c - path[i - 1]!.c)
  }
  return total
}

/**
 * A route for the edge from `source` to `target`, both inside `bounds` (their
 * subgraph's box), kept clear of `others`. The cheapest of a straight line, a
 * Z for an edge that runs with the flow, and a hook out of the side of the
 * source and up the side of the target for one that runs against it. `undefined`
 * if nothing fits.
 */
export function routeInnerEdge(
  source: PositionedNode,
  target: PositionedNode,
  others: readonly PositionedNode[],
  bounds: BoxLike,
  direction: Direction,
  drawn: readonly (readonly Point[])[] = [],
): Point[] | undefined {
  const frame = frameFor(direction)
  const S = frame.span(source)
  const T = frame.span(target)
  const forward = S.a1 <= T.a0
  const backward = T.a1 <= S.a0
  if (!forward && !backward) return undefined

  const inner = frame.span(bounds)
  const room: Span = {
    a0: inner.a0 + BORDER_INSET,
    a1: inner.a1 - BORDER_INSET,
    c0: inner.c0 + BORDER_INSET,
    c1: inner.c1 - BORDER_INSET,
  }
  const before = drawn.map((path) => path.map((p) => toPt(frame, p)))
  const blocks = others.map((n) => grow(frame.span(n), CLEARANCE))
  const mid = (s: Span): number => (s.c0 + s.c1) / 2
  const midA = (s: Span): number => (s.a0 + s.a1) / 2
  const flat = (n: PositionedNode): boolean => FLAT_SIDED.has(n.shape)

  /** Whether every segment is clear of the nodes, the ends touch only their own node, and it stays in the box. */
  const valid = (path: Pt[]): boolean => {
    for (const p of path) {
      if (p.a < room.a0 || p.a > room.a1 || p.c < room.c0 || p.c > room.c1) {
        return false
      }
    }
    for (let i = 1; i < path.length; i++) {
      const p = path[i - 1]!
      const q = path[i]!
      if (p.a !== q.a && p.c !== q.c) return false
      if (blocks.some((b) => crosses(p, q, b))) return false
      if (crosses(p, q, S) || crosses(p, q, T)) return false
      if (before.some((path) => runsAlong(p, q, path))) return false
    }
    return true
  }

  // Cross-flow positions worth trying: where the two nodes are, and just clear
  // of every node and the box's border.
  const candidates = new Set<number>([mid(S), mid(T), room.c0, room.c1])
  for (const b of blocks) {
    candidates.add(b.c0 - 1)
    candidates.add(b.c1 + 1)
  }
  for (const s of [S, T]) {
    candidates.add(s.c0 - CLEARANCE)
    candidates.add(s.c1 + CLEARANCE)
  }
  const within = (n: PositionedNode, s: Span, c: number): boolean =>
    flat(n) ? c >= s.c0 + 4 && c <= s.c1 - 4 : Math.abs(c - mid(s)) < 0.5

  const routes: Pt[][] = []
  if (forward) {
    const gap = (T.a0 - S.a1) / 2
    const a1 = S.a1 + Math.min(STUB, gap)
    const a2 = T.a0 - Math.min(STUB, gap)
    for (const c of candidates) {
      if (within(source, S, c) && within(target, T, c)) {
        routes.push([
          { a: S.a1, c },
          { a: T.a0, c },
        ])
      }
      // A Z, or an L-shaped pair of turns when one end can take the edge off centre.
      routes.push([
        { a: S.a1, c: mid(S) },
        { a: a1, c: mid(S) },
        { a: a1, c },
        { a: a2, c },
        { a: a2, c: mid(T) },
        { a: T.a0, c: mid(T) },
      ])
      if (within(target, T, c)) {
        routes.push([
          { a: S.a1, c: mid(S) },
          { a: a1, c: mid(S) },
          { a: a1, c },
          { a: T.a0, c },
        ])
      }
      if (within(source, S, c)) {
        routes.push([
          { a: S.a1, c },
          { a: a2, c },
          { a: a2, c: mid(T) },
          { a: T.a0, c: mid(T) },
        ])
      }
      // Out of the source's side and down: for a decision, whose other
      // branches leave by the bottom.
      const side = c >= S.c1 ? S.c1 : c <= S.c0 ? S.c0 : undefined
      if (side !== undefined) {
        const down = within(target, T, c)
          ? [{ a: T.a0, c }]
          : [
              { a: a2, c },
              { a: a2, c: mid(T) },
              { a: T.a0, c: mid(T) },
            ]
        routes.push([{ a: midA(S), c: side }, { a: midA(S), c }, ...down])
      }
    }
  } else {
    for (const c of candidates) {
      const side = c >= T.c1 ? T.c1 : c <= T.c0 ? T.c0 : undefined
      if (side === undefined) continue
      // Out of the source's back, up, and into the target's side.
      if (within(source, S, c)) {
        routes.push([
          { a: S.a0, c },
          { a: midA(T), c },
          { a: midA(T), c: side },
        ])
      }
      // Out of the source's side, along, up, and into the target's side.
      const out = side === T.c1 ? S.c1 : S.c0
      routes.push([
        { a: midA(S), c: out },
        { a: midA(S), c },
        { a: midA(T), c },
        { a: midA(T), c: side },
      ])
    }
  }

  let best: Pt[] | undefined
  let bestCost = Number.POSITIVE_INFINITY
  for (const route of routes) {
    const path = simplify(route)
    if (path.length < 2 || !valid(path)) continue
    // A decision's branches fan out of its sides; leaving by the bottom only
    // when nothing else fits.
    const stem =
      source.shape === 'diamond' && path[0]!.a === S.a1 ? DECISION_STEM : 0
    const cost = length(path) + BEND_COST * (path.length - 2) + stem
    if (cost < bestCost) {
      best = path
      bestCost = cost
    }
  }
  return best?.map(frame.toPoint)
}

/** The middle of a path's longest segment, where an edge label sits. */
export function labelSpot(points: readonly Point[]): Point {
  let best = { x: points[0]!.x, y: points[0]!.y }
  let longest = -1
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1]!
    const q = points[i]!
    const len = Math.abs(q.x - p.x) + Math.abs(q.y - p.y)
    if (len > longest) {
      longest = len
      best = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
    }
  }
  return best
}
