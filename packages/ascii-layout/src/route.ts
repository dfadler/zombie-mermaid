// Dijkstra over the character grid, pulled toward ELK's polyline.

/** Direction bits and unit vectors, indexed N, E, S, W. */
export const BIT = [1, 2, 4, 8] as const
export const DX = [0, 1, 0, -1] as const
export const DY = [-1, 0, 1, 0] as const

/** Cell kinds: 0 free, 1 inside a node box (border included), 2 the one-cell halo around a box. */
export interface RouteGrid {
  W: number
  H: number
  kind: Int32Array
  /** Halo cell reserved for one edge end (bundle*2+end), or -1. */
  owner: Int32Array
  /** Direction bits of the lines already drawn through each cell. */
  occ: Int32Array
}

export interface RouteEnd {
  x: number
  y: number
  /** Heading: leaving the source (0..3 = N,E,S,W) or arriving at the target. */
  d: number
}

const TURN_COST = 2.5
const GUIDE_WEIGHT = 1.5
const CROSS_COST = 4
const RELAXED_OVERLAP_COST = 30

/** Binary min-heap of [cost, state]. */
class Heap {
  private a: [number, number][] = []
  get size() {
    return this.a.length
  }
  push(c: number, s: number) {
    const a = this.a
    a.push([c, s])
    let i = a.length - 1
    while (i && a[(i - 1) >> 1]![0] > a[i]![0]) {
      ;[a[(i - 1) >> 1], a[i]] = [a[i]!, a[(i - 1) >> 1]!]
      i = (i - 1) >> 1
    }
  }
  pop(): [number, number] {
    const a = this.a
    const top = a[0]!
    const last = a.pop()!
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        let m = i
        for (const c of [2 * i + 1, 2 * i + 2])
          if (c < a.length && a[c]![0] < a[m]![0]) m = c
        if (m === i) break
        ;[a[m], a[i]] = [a[i]!, a[m]!]
        i = m
      }
    }
    return top
  }
}

function guideDistance(
  guide: [number, number][],
  x: number,
  y: number,
): number {
  let best = Infinity
  for (let i = 0; i + 1 < guide.length; i++) {
    const [ax, ay] = guide[i]!
    const [bx, by] = guide[i + 1]!
    const vx = bx - ax
    const vy = by - ay
    const len = vx * vx + vy * vy || 1
    const t = Math.max(
      0,
      Math.min(1, ((x + 0.5 - ax) * vx + (y + 0.5 - ay) * vy) / len),
    )
    best = Math.min(
      best,
      Math.hypot(x + 0.5 - ax - t * vx, y + 0.5 - ay - t * vy),
    )
  }
  return best
}

/**
 * Cheapest orthogonal path from `from` to `to`. A line may cross an existing one only straight
 * through it at a right angle (never turn on an occupied cell); nodes are impassable; the halo
 * cell next to a box is usable only by the edge end that owns it. `relaxed` additionally allows
 * overlapping lines (a last resort that breaks the right-angle rule; reported by the caller).
 */
export function route(
  g: RouteGrid,
  from: RouteEnd,
  to: RouteEnd,
  me: number,
  guide: [number, number][],
  relaxed: boolean,
): [number, number][] | null {
  const { W, H, kind, owner, occ } = g
  const dist = new Float64Array(W * H * 4).fill(Infinity)
  const prev = new Int32Array(W * H * 4).fill(-1)
  const heap = new Heap()
  const start = (from.y * W + from.x) * 4 + from.d
  dist[start] = 0
  heap.push(0, start)
  while (heap.size) {
    const [c, s] = heap.pop()
    if (c > dist[s]!) continue
    const d = s & 3
    const cell = s >> 2
    const x = cell % W
    const y = (cell / W) | 0
    if (x === to.x && y === to.y && d === to.d) {
      const path: [number, number][] = []
      for (let q = s; q !== -1; q = prev[q]!)
        path.unshift([(q >> 2) % W, ((q >> 2) / W) | 0])
      return path
    }
    const first = s === start
    for (const nd of first ? [d] : [d, (d + 1) & 3, (d + 3) & 3]) {
      if (nd !== d && occ[cell] !== 0) continue
      const nx = x + DX[nd]!
      const ny = y + DY[nd]!
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
      const n = ny * W + nx
      const k = kind[n]!
      if (k === 1) continue
      if (
        k === 2 &&
        !(nx === to.x && ny === to.y && nd === to.d && owner[n] === me)
      )
        continue
      let pen = 0
      if (occ[n] !== 0) {
        if (nx === to.x && ny === to.y) continue
        if (occ[n] === (nd & 1 ? BIT[0] | BIT[2] : BIT[1] | BIT[3]))
          pen = CROSS_COST
        else if (relaxed) pen = RELAXED_OVERLAP_COST
        else continue
      }
      const nc =
        c +
        1 +
        GUIDE_WEIGHT * guideDistance(guide, nx, ny) +
        (nd !== d ? TURN_COST : 0) +
        pen
      const ns = n * 4 + nd
      if (nc < dist[ns]!) {
        dist[ns] = nc
        prev[ns] = s
        heap.push(nc, ns)
      }
    }
  }
  return null
}
