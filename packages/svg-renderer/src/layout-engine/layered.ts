/**
 * A small layered (Sugiyama-style) graph layout, with no dependencies.
 *
 * Backs `layout: 'simple'` (#1685). It is deliberately plain: longest-path
 * ranking, barycenter crossing reduction, and a least-squares coordinate pass.
 * It works in an abstract frame so one implementation serves every direction:
 * the *axis* runs along the flow (rank to rank), the *cross* axis runs across
 * it. `simple-layout.ts` maps that frame onto x/y for TB, BT, LR and RL.
 *
 * Every edge gets a dummy node on each rank it crosses, and ranks are doubled
 * (real nodes sit on even ranks) so that every edge, even one between adjacent
 * nodes, owns a slot on an odd rank in between. That slot is where an edge
 * label goes, and it is what keeps parallel edges apart. An odd rank with no
 * label has height 0, so an unlabeled graph spaces its ranks by `rankSep`
 * exactly.
 */

import { findBackEdges } from '@zombie-mermaid/core'

/** Size of a node in the abstract frame. */
export interface LayeredNode {
  /** Extent along the flow. */
  axis: number
  /** Extent across the flow. */
  cross: number
  /** Extra room reserved on the high side of the cross axis (self-loops). */
  after?: number
}

export interface LayeredEdge {
  from: number
  to: number
  /** Label box, in the abstract frame. */
  label?: { axis: number; cross: number }
}

export interface LayeredOptions {
  /** Gap between neighbours on a rank. */
  nodeSep: number
  /** Gap between ranks of real nodes. */
  rankSep: number
}

/** A centre point in the abstract frame. */
export interface Waypoint {
  axis: number
  cross: number
}

export interface LayeredResult {
  /** Top-left corner of each input node (axis, cross). */
  nodes: Waypoint[]
  /**
   * Per input edge: the centres of the dummy nodes it passes through, ordered
   * from `from` to `to` (empty for a self-loop).
   */
  paths: Waypoint[][]
  /** Per input edge: where its label goes. */
  labels: (Waypoint | undefined)[]
  axisSize: number
  crossSize: number
}

/** Gap beside a dummy node (an edge passing by), so parallel edges stay close. */
const EDGE_SEP = 12
/** Barycenter sweeps before giving up on a better ordering. */
const MAX_SWEEPS = 8
/** Coordinate-assignment passes (each is a down sweep then an up sweep). */
const COORD_PASSES = 4

interface Slot {
  axis: number
  cross: number
  after: number
  rank: number
  real: boolean
}

export function layered(
  nodes: readonly LayeredNode[],
  edges: readonly LayeredEdge[],
  opts: LayeredOptions,
): LayeredResult {
  const slots: Slot[] = nodes.map((n) => ({
    axis: n.axis,
    cross: n.cross,
    after: n.after ?? 0,
    rank: 0,
    real: true,
  }))
  const up: number[][] = nodes.map(() => [])
  const down: number[][] = nodes.map(() => [])

  // 1. Acyclic: reverse the edges a depth-first walk finds closing a cycle,
  // the same ones the ELK path reverses (see core/back-edges.ts).
  const live = edges.flatMap((e, index) => (e.from === e.to ? [] : [index]))
  const back = findBackEdges(
    live.map((i) => ({
      source: String(edges[i]!.from),
      target: String(edges[i]!.to),
    })),
    nodes.map((_, i) => String(i)),
  )
  const directed = live.map((index, j) => {
    const e = edges[index]!
    return back.has(j)
      ? { index, u: e.to, v: e.from, reversed: true }
      : { index, u: e.from, v: e.to, reversed: false }
  })

  // 2. Longest-path ranking, in doubled ranks (a Kahn walk over the DAG).
  const outs = nodes.map(() => [] as number[])
  const indegree = nodes.map(() => 0)
  for (const d of directed) {
    outs[d.u]!.push(d.v)
    indegree[d.v]!++
  }
  const queue = indegree.flatMap((deg, i) => (deg === 0 ? [i] : []))
  for (let head = 0; head < queue.length; head++) {
    const u = queue[head]!
    for (const v of outs[u]!) {
      slots[v]!.rank = Math.max(slots[v]!.rank, slots[u]!.rank + 2)
      if (--indegree[v]! === 0) queue.push(v)
    }
  }

  // 3. A dummy per rank crossed. The label rides the odd rank nearest the middle.
  const chains = directed.map((d) => {
    const span = (slots[d.v]!.rank - slots[d.u]!.rank) / 2
    const labelRank = slots[d.u]!.rank + 2 * Math.floor(span / 2) + 1
    const label = edges[d.index]!.label
    const chain = [d.u]
    for (let r = slots[d.u]!.rank + 1; r < slots[d.v]!.rank; r++) {
      const id = slots.length
      const holdsLabel = r === labelRank && label !== undefined
      slots.push({
        axis: holdsLabel ? label.axis : 0,
        cross: holdsLabel ? label.cross : 0,
        after: 0,
        rank: r,
        real: false,
      })
      up.push([])
      down.push([])
      chain.push(id)
    }
    chain.push(d.v)
    for (let k = 1; k < chain.length; k++) {
      down[chain[k - 1]!]!.push(chain[k]!)
      up[chain[k]!]!.push(chain[k - 1]!)
    }
    return { chain, labelRank }
  })

  // 4. Components, each ordered and positioned on its own, then packed.
  const parent = slots.map((_, i) => i)
  const find = (start: number): number => {
    let a = start
    while (parent[a] !== a) a = parent[a] = parent[parent[a]!]!
    return a
  }
  for (const { chain } of chains) {
    for (const s of chain) parent[find(s)] = find(chain[0]!)
  }
  const components = new Map<number, number[]>()
  slots.forEach((_, s) => {
    const root = find(s)
    components.set(root, [...(components.get(root) ?? []), s])
  })

  const cross = slots.map(() => 0)
  const extents: { min: number; max: number }[] = []
  const componentSlots: number[][] = []
  for (const members of components.values()) {
    const x = placeComponent(members, slots, up, down, opts)
    let min = Infinity
    let max = -Infinity
    for (const s of members) {
      cross[s] = x.get(s)!
      min = Math.min(min, cross[s]! - slots[s]!.cross / 2)
      max = Math.max(max, cross[s]! + slots[s]!.cross / 2 + slots[s]!.after)
    }
    extents.push({ min, max })
    componentSlots.push(members)
  }
  let cursor = 0
  componentSlots.forEach((members, c) => {
    const shift = cursor - extents[c]!.min
    for (const s of members) cross[s] = cross[s]! + shift
    cursor += extents[c]!.max - extents[c]!.min + opts.nodeSep
  })
  const crossSize = Math.max(0, cursor - opts.nodeSep)

  // 5. Axis: every rank is as tall as its tallest slot; slots centre in it.
  const maxRank = slots.reduce((m, s) => Math.max(m, s.rank), 0)
  const height = new Array<number>(maxRank + 1).fill(0)
  for (const s of slots) height[s.rank] = Math.max(height[s.rank]!, s.axis)
  const start = new Array<number>(maxRank + 1).fill(0)
  for (let r = 1; r <= maxRank; r++) {
    start[r] = start[r - 1]! + height[r - 1]! + opts.rankSep / 2
  }
  const axisCentre = (s: number): number =>
    start[slots[s]!.rank]! + height[slots[s]!.rank]! / 2

  const paths: Waypoint[][] = edges.map(() => [])
  const labels: (Waypoint | undefined)[] = edges.map(() => undefined)
  directed.forEach((d, j) => {
    const { chain, labelRank } = chains[j]!
    const mids = chain.slice(1, -1)
    const points = mids.map((s) => ({ axis: axisCentre(s), cross: cross[s]! }))
    paths[d.index] = d.reversed ? points.reverse() : points
    if (edges[d.index]!.label) {
      const holder = mids.find((s) => slots[s]!.rank === labelRank)!
      labels[d.index] = { axis: axisCentre(holder), cross: cross[holder]! }
    }
  })

  return {
    nodes: nodes.map((n, i) => ({
      axis: start[slots[i]!.rank]! + (height[slots[i]!.rank]! - n.axis) / 2,
      cross: cross[i]! - n.cross / 2,
    })),
    paths,
    labels,
    axisSize: start[maxRank]! + height[maxRank]!,
    crossSize,
  }
}

/** Cross-axis centre of every slot of one connected component. */
function placeComponent(
  members: number[],
  slots: Slot[],
  up: number[][],
  down: number[][],
  opts: LayeredOptions,
): Map<number, number> {
  // Initial order: depth-first from the lowest ranks, as dagre does.
  const rows: number[][] = []
  const seen = new Set<number>()
  const byRank = [...members].sort(
    (a, b) => slots[a]!.rank - slots[b]!.rank || a - b,
  )
  for (const root of byRank) {
    if (seen.has(root)) continue
    const stack = [{ s: root, next: 0 }]
    seen.add(root)
    ;(rows[slots[root]!.rank] ??= []).push(root)
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!
      const child = down[frame.s]![frame.next++]
      if (child === undefined) {
        stack.pop()
      } else if (!seen.has(child)) {
        seen.add(child)
        ;(rows[slots[child]!.rank] ??= []).push(child)
        stack.push({ s: child, next: 0 })
      }
    }
  }
  const layers = rows.filter((r) => r !== undefined)

  // Crossing reduction: alternate barycenter sweeps, keep the best order.
  const position = new Map<number, number>()
  const reindex = (): void =>
    layers.forEach((row) => row.forEach((s, i) => position.set(s, i)))
  const crossings = (): number => {
    let total = 0
    for (let r = 0; r + 1 < layers.length; r++) {
      const segs = layers[r]!.flatMap((a) =>
        down[a]!.map((b) => [position.get(a)!, position.get(b)!] as const),
      )
      // ponytail: pairwise count, O(E^2) per rank pair; a BIT makes it E log E
      for (let i = 0; i < segs.length; i++) {
        for (let k = i + 1; k < segs.length; k++) {
          const [a1, b1] = segs[i]!
          const [a2, b2] = segs[k]!
          if ((a1 - a2) * (b1 - b2) < 0) total++
        }
      }
    }
    return total
  }
  reindex()
  let best = layers.map((r) => [...r])
  let bestCrossings = crossings()
  for (let sweep = 0; sweep < MAX_SWEEPS && bestCrossings > 0; sweep++) {
    const downward = sweep % 2 === 0
    const order = layers.map((_, r) => r)
    if (!downward) order.reverse()
    for (const r of order) {
      const neighbours = downward ? up : down
      const key = (s: number): number => {
        const ns = neighbours[s]!
        return ns.length === 0
          ? position.get(s)!
          : ns.reduce((sum, n) => sum + position.get(n)!, 0) / ns.length
      }
      const keys = new Map(layers[r]!.map((s) => [s, key(s)]))
      layers[r]!.sort(
        (a, b) =>
          keys.get(a)! - keys.get(b)! || position.get(a)! - position.get(b)!,
      )
      layers[r]!.forEach((s, i) => position.set(s, i))
    }
    const score = crossings()
    if (score < bestCrossings) {
      bestCrossings = score
      best = layers.map((r) => [...r])
    }
  }
  best.forEach((row, r) => (layers[r] = row))

  // Coordinates: pull each slot toward its neighbours' mean, keeping the gaps.
  const x = new Map<number, number>()
  const gap = (a: number, b: number): number =>
    (slots[a]!.cross + slots[b]!.cross) / 2 +
    slots[a]!.after +
    (slots[a]!.real && slots[b]!.real
      ? opts.nodeSep
      : Math.min(opts.nodeSep, EDGE_SEP))
  const settle = (row: number[], neighbours: number[][]): void => {
    const gaps = row.slice(1).map((s, i) => gap(row[i]!, s))
    const offsets = [0]
    gaps.forEach((g, i) => offsets.push(offsets[i]! + g))
    const targets = row.map((s, i) => {
      const ns = (neighbours[s] ?? []).filter((n) => x.has(n))
      const want =
        ns.length === 0
          ? (x.get(s) ?? 0)
          : ns.reduce((sum, n) => sum + x.get(n)!, 0) / ns.length
      return want - offsets[i]!
    })
    monotone(targets).forEach((y, i) => x.set(row[i]!, y + offsets[i]!))
  }
  for (const row of layers) settle(row, [])
  for (let pass = 0; pass < COORD_PASSES; pass++) {
    for (let r = 1; r < layers.length; r++) settle(layers[r]!, up)
    for (let r = layers.length - 2; r >= 0; r--) settle(layers[r]!, down)
  }
  return x
}

/**
 * The non-decreasing sequence closest to `values` in least squares (pool
 * adjacent violators). With each value pre-shifted by its minimum offset this
 * is "closest placement that keeps every gap".
 */
function monotone(values: number[]): number[] {
  const blocks: { sum: number; count: number }[] = []
  for (const v of values) {
    blocks.push({ sum: v, count: 1 })
    while (blocks.length > 1) {
      const last = blocks[blocks.length - 1]!
      const prev = blocks[blocks.length - 2]!
      if (prev.sum / prev.count <= last.sum / last.count) break
      blocks.splice(-2, 2, {
        sum: prev.sum + last.sum,
        count: prev.count + last.count,
      })
    }
  }
  return blocks.flatMap((b) => new Array<number>(b.count).fill(b.sum / b.count))
}
