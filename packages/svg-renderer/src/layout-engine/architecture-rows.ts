/**
 * Architecture row alignment (#2473). Mermaid puts every service on a grid, so
 * `fan:R --> L:db` leaves `db` on `fan`'s row. ELK centres a group's stack on
 * the services around it instead: with `db` above a stacked `replica`, the
 * whole `data` group sat centred on `fan` and `db` rode half a stack above the
 * row. This shifts such a group, rigidly, along the cross-flow axis until the
 * member linked to a node outside it on the same grid row is level with it.
 */

import type {
  MermaidGraph,
  MermaidSubgraph,
  PositionedEdge,
  PositionedGroup,
  PositionedNode,
} from '@zombie-mermaid/core'
import { moveEdgeEnds } from './layer-alignment.ts'

/** Shifts under this many px are layout noise, not misalignment. */
const MIN_SHIFT = 0.5

interface Span {
  lo: number
  hi: number
}

const overlaps = (a: Span, b: Span): boolean => a.lo < b.hi && b.lo < a.hi

/**
 * Shift each architecture group so its row-anchored member lines up with the
 * outside node it links to. Returns whether anything moved.
 */
export function alignArchitectureRows(
  graph: MermaidGraph,
  nodes: PositionedNode[],
  edges: PositionedEdge[],
  groups: PositionedGroup[],
): boolean {
  const horizontal = graph.direction === 'LR' || graph.direction === 'RL'
  const k = horizontal ? 'y' : 'x'
  const size = horizontal ? 'height' : 'width'
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const parentOf = new Map<PositionedGroup, PositionedGroup | undefined>()
  const groupById = new Map<string, PositionedGroup>()
  const index = (list: PositionedGroup[], parent?: PositionedGroup): void => {
    for (const g of list) {
      parentOf.set(g, parent)
      groupById.set(g.id, g)
      index(g.children, g)
    }
  }
  index(groups)
  type Rect = Pick<PositionedNode, 'x' | 'y' | 'width' | 'height'>
  const f = horizontal ? 'x' : 'y'
  const fsize = horizontal ? 'width' : 'height'
  const span = (b: Rect, shift = 0): Span => ({
    lo: b[k] + shift,
    hi: b[k] + shift + b[size],
  })
  const flow = (b: Rect): Span => ({ lo: b[f], hi: b[f] + b[fsize] })
  const row = (id: string): number | undefined => graph.nodes.get(id)?.gridOrder

  let moved = false
  // Innermost first, so a group that moves carries the ones inside it.
  const visit = (sg: MermaidSubgraph): void => {
    sg.children.forEach(visit)
    const group = groupById.get(sg.id)
    if (!group) return

    const members = new Set<string>()
    const memberGroups = new Set<PositionedGroup>()
    const collect = (s: MermaidSubgraph): void => {
      s.nodeIds.forEach((id) => members.add(id))
      const g = groupById.get(s.id)
      if (g) memberGroups.add(g)
      s.children.forEach(collect)
    }
    collect(sg)

    // The first linked pair on one grid row that is not already level.
    let dy = 0
    for (const e of graph.edges) {
      for (const [inside, outside] of [
        [e.source, e.target],
        [e.target, e.source],
      ] as const) {
        const a = nodeById.get(inside)
        const b = nodeById.get(outside)
        if (dy !== 0 || !a || !b || !members.has(inside)) continue
        if (members.has(outside)) continue
        const r = row(inside)
        if (r === undefined || r !== row(outside)) continue
        const d = b[k] + b[size] / 2 - (a[k] + a[size] / 2)
        if (Math.abs(d) > MIN_SHIFT) dy = d
      }
    }
    if (dy === 0) return

    // Skip a shift that would leave the canvas or land on a neighbour.
    const to = span(group, dy)
    if (to.lo < 0) return
    const hits = (r: Rect): boolean =>
      overlaps(to, span(r)) && overlaps(flow(group), flow(r))
    const blocked =
      nodes.some((n) => !members.has(n.id) && hits(n)) ||
      [...groupById.values()].some(
        (g) => !memberGroups.has(g) && !ancestors(group).includes(g) && hits(g),
      )
    if (blocked) return

    // Ancestors keep their margins around the block.
    const margins = ancestors(group).map((a) => ({
      a,
      before: group[k] - a[k],
      after: a[k] + a[size] - (group[k] + group[size]),
    }))
    for (const n of nodes) if (members.has(n.id)) n[k] += dy
    for (const g of memberGroups) g[k] += dy
    for (const { a, before, after } of margins) {
      const lo = Math.min(a[k], group[k] - before)
      const hi = Math.max(a[k] + a[size], group[k] + group[size] + after)
      a[k] = lo
      a[size] = hi - lo
    }
    const crossing = new Map<string, number>()
    for (const id of members) crossing.set(id, dy)
    const border: PositionedEdge[] = []
    for (const e of edges) {
      const s = members.has(e.source)
      const t = members.has(e.target)
      if (s && t) for (const p of e.points) p[k] += dy
      else if (s || t) border.push(e)
    }
    moveEdgeEnds(border, crossing, k)
    moved = true
  }
  graph.subgraphs.forEach(visit)

  function ancestors(g: PositionedGroup): PositionedGroup[] {
    const out: PositionedGroup[] = []
    for (let p = parentOf.get(g); p; p = parentOf.get(p)) out.push(p)
    return out
  }
  return moved
}

/** Room the layout leaves between a group's edge and its members along the flow. */
const FLOW_PAD = 16

/**
 * `fan:B --> T:replica` stacks `replica` under `fan`, but ELK holds `replica`
 * to its group's grid layer, beside the group's other members. For an
 * `acrossFlow` edge whose end sits in a group that does not hold the other
 * end, slide that end along the flow until it is centred under (or over) the
 * other, and grow its groups to take it in (Mermaid does the same, so the
 * group then spans the junction). Skipped when it has other edges or the grown
 * group would land on a neighbour. Returns whether anything moved.
 */
export function alignAcrossFlowMembers(
  graph: MermaidGraph,
  nodes: PositionedNode[],
  groups: PositionedGroup[],
): boolean {
  const horizontal = graph.direction === 'LR' || graph.direction === 'RL'
  const [f, fsize, k, size] = horizontal
    ? (['x', 'width', 'y', 'height'] as const)
    : (['y', 'height', 'x', 'width'] as const)
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const groupById = new Map<string, PositionedGroup>()
  const indexGroups = (list: PositionedGroup[]): void => {
    for (const g of list) {
      groupById.set(g.id, g)
      indexGroups(g.children)
    }
  }
  indexGroups(groups)
  // Group ids holding each node and each group, innermost first.
  const chains = new Map<string, string[]>()
  const walk = (sg: MermaidSubgraph, above: string[]): void => {
    const chain = [sg.id, ...above]
    chains.set(sg.id, above)
    for (const id of sg.nodeIds) chains.set(id, chain)
    sg.children.forEach((c) => walk(c, chain))
  }
  graph.subgraphs.forEach((sg) => walk(sg, []))
  const centre = (n: PositionedNode): number => n[f] + n[fsize] / 2
  const clash = (a: PositionedNode | PositionedGroup, b: typeof a): boolean =>
    a[f] < b[f] + b[fsize] &&
    b[f] < a[f] + a[fsize] &&
    a[k] < b[k] + b[size] &&
    b[k] < a[k] + a[size]

  let moved = false
  for (const e of graph.edges) {
    const a = nodeById.get(e.source)
    const b = nodeById.get(e.target)
    if (!e.acrossFlow || !a || !b) continue
    const ca = chains.get(a.id) ?? []
    const cb = chains.get(b.id) ?? []
    // Move the end whose innermost group does not hold the other end.
    const [m, anchor, own, other] =
      cb[0] !== undefined && !ca.includes(cb[0])
        ? ([b, a, cb, ca] as const)
        : ca[0] !== undefined && !cb.includes(ca[0])
          ? ([a, b, ca, cb] as const)
          : []
    if (!m || !anchor || !own || !other) continue
    const d = centre(anchor) - centre(m)
    if (Math.abs(d) <= MIN_SHIFT) continue
    if (
      graph.edges.some(
        (x) => x !== e && (x.source === m.id || x.target === m.id),
      )
    )
      continue

    // The groups that will grow past the anchor; the outermost must stay clear.
    const grown = own.filter((id) => !other.includes(id))
    const top = groupById.get(grown[grown.length - 1]!)
    if (!top) continue
    const lo = Math.min(top[f], m[f] + d - FLOW_PAD)
    const hi = Math.max(top[f] + top[fsize], m[f] + d + m[fsize] + FLOW_PAD)
    const next = { ...top, [f]: lo, [fsize]: hi - lo }
    const inside = (id: string): boolean =>
      (chains.get(id) ?? []).includes(top.id)
    const blocked =
      nodes.some((n) => n !== anchor && !inside(n.id) && clash(next, n)) ||
      [...groupById.values()].some(
        (g) =>
          g !== top &&
          !inside(g.id) &&
          !(chains.get(top.id) ?? []).includes(g.id) &&
          clash(next, g),
      )
    if (blocked) continue

    m[f] += d
    for (const id of own) {
      const g = groupById.get(id)
      if (!g) continue
      const glo = Math.min(g[f], m[f] - FLOW_PAD)
      const ghi = Math.max(g[f] + g[fsize], m[f] + m[fsize] + FLOW_PAD)
      g[f] = glo
      g[fsize] = ghi - glo
    }
    moved = true
  }
  return moved
}

/** Largest port offset, in px, that is spreading rather than a deliberate lane. */
const MAX_PORT_SPREAD = 8

/**
 * ELK spreads a node's ports across its side, so an edge leaves a junction a
 * few px off its centre and jogs back to its level target. Mermaid draws
 * architecture edges from the middle of each side, so pull the end back to the
 * node's centre line when the first leg runs along the flow.
 */
export function centreArchitectureEnds(
  graph: MermaidGraph,
  nodes: PositionedNode[],
  edges: PositionedEdge[],
): void {
  const horizontal = graph.direction === 'LR' || graph.direction === 'RL'
  const [k, size] = horizontal
    ? (['y', 'height'] as const)
    : (['x', 'width'] as const)
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  for (const e of edges) {
    const pts = e.points
    for (const [id, end, step] of [
      [e.source, 0, 1],
      [e.target, pts.length - 1, -1],
    ] as const) {
      const n = nodeById.get(id)
      const a = pts[end]
      const b = pts[end + step]
      if (!n || !a || !b || graph.nodes.get(id)?.gridOrder === undefined)
        continue
      const mid = n[k] + n[size] / 2
      const off = Math.abs(a[k] - mid)
      if (off < MIN_SHIFT || off > MAX_PORT_SPREAD || b[k] !== a[k]) continue
      a[k] = b[k] = mid
    }
    e.points = pts.filter((p, i) => {
      const q = pts[i - 1]
      return !q || q.x !== p.x || q.y !== p.y
    })
  }
}
