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
