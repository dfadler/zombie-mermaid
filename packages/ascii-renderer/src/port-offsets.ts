// ============================================================================
// ASCII renderer — stroke offsets for edges that share a node port
//
// An edge leaves or enters a node at a *port*: the grid cell on the node's
// border where its path starts or ends. Edges are routed on a coarse grid, so
// every edge that uses the same side of a node lands on the same cell, and
// without help their strokes are drawn on top of each other: a reciprocal pair
// plus a third edge off the same side share one column, with junctions and
// arrowheads piled up so no stroke can be followed (#1350).
//
// Mermaid draws each edge as its own path. Here each edge sharing a port is
// given its own column along the node's border instead. The offset applies to
// the vertical run of the path that touches the port (the first run for the
// source end, the last for the target end); everything past the first bend is
// left where the router put it, so the run just shifts sideways and the next
// horizontal segment starts from the shifted corner.
//
// Edges that run straight from one port to another need one column at both
// ends, so they are assigned first and constrain both ports. Edges in a bundle
// (a shared fan-in/fan-out trunk), cluster edges and self-loops keep their
// routed geometry and are treated as fixed occupants of the column they use.
// ============================================================================

import type { AsciiEdge, AsciiGraph, AsciiNode, GridCoord } from './types.ts'
import { gridToDrawingCoord, lineToDrawing } from './grid.ts'
import type { DrawingCoord } from './types.ts'

/** Cells between a fixed stroke and a moved one (one blank cell). */
const STROKE_SPACING = 2

/** A vertical run of an edge's path that touches a node port. */
interface PortRun {
  /** Grid column the run sits on. */
  col: number
  /** Index of its first and last path point. */
  from: number
  to: number
  /** Which side of the node it leaves from / arrives at. */
  side: 'top' | 'bottom'
  node: AsciiNode
  /** Cell in the node's block where the run touches the port. */
  cell: GridCoord
  /** Direction of the first horizontal move off the run: -1, 0 (none) or 1. */
  turn: -1 | 0 | 1
}

interface EdgeRuns {
  start?: PortRun
  end?: PortRun
  /** Straight edge: one run covers the whole path, so one offset serves both. */
  straight: boolean
}

/** Drawn-column shift for the points of each edge's first and last run. */
export interface PortShift {
  start: number
  end: number
  startRun?: { col: number; from: number; to: number }
  endRun?: { col: number; from: number; to: number }
}

const portKey = (node: AsciiNode, cell: GridCoord): string =>
  `${node.index}|${cell.x},${cell.y}`

function isFixed(edge: AsciiEdge): boolean {
  return (
    edge.from === edge.to ||
    edge.path.length < 2 ||
    edge.bundle !== undefined ||
    edge.style === 'invisible' ||
    edge.clusterSource !== undefined ||
    edge.clusterTarget !== undefined
  )
}

function runsOf(edge: AsciiEdge): EdgeRuns | undefined {
  const p = edge.path
  const last = p.length - 1
  const col0 = p[0]!.x
  const colN = p[last]!.x
  let startEnd = -1
  if (p[1]!.x === col0 && p[1]!.y !== p[0]!.y) {
    startEnd = 1
    while (startEnd + 1 <= last && p[startEnd + 1]!.x === col0) startEnd++
  }
  let endStart = -1
  if (p[last - 1]!.x === colN && p[last - 1]!.y !== p[last]!.y) {
    endStart = last - 1
    while (endStart - 1 >= 0 && p[endStart - 1]!.x === colN) endStart--
  }
  if (startEnd < 0 && endStart < 0) return undefined

  const straight = startEnd === last && endStart === 0
  const result: EdgeRuns = { straight }
  if (startEnd >= 0) {
    const down = p[1]!.y > p[0]!.y
    const next = p[startEnd + 1]
    result.start = {
      col: col0,
      from: 0,
      to: startEnd,
      side: down ? 'bottom' : 'top',
      node: edge.from,
      cell: p[0]!,
      turn: next ? (next.x > col0 ? 1 : -1) : 0,
    }
  }
  if (endStart >= 0) {
    const down = p[last]!.y > p[last - 1]!.y
    const before = p[endStart - 1]
    result.end = {
      col: colN,
      from: endStart,
      to: last,
      side: down ? 'top' : 'bottom',
      node: edge.to,
      cell: p[last]!,
      // An edge arriving from the right sits on the right of its port.
      turn: before ? (before.x > colN ? 1 : -1) : 0,
    }
  }
  return result
}

/** Drawing x of a port's centre, and the node's borders in drawing columns. */
function portGeometry(
  graph: AsciiGraph,
  run: PortRun,
): { cx: number; lo: number; hi: number; row: number } | undefined {
  const node = run.node
  const dc = node.drawingCoord
  const drawing = node.drawing
  if (!dc || !drawing) return undefined
  const width = drawing.length
  const height = drawing[0]?.length ?? 0
  if (width < 3 || height < 1) return undefined
  const row = run.side === 'top' ? 0 : height - 1
  return {
    cx: gridToDrawingCoord(graph, run.cell).x,
    lo: dc.x + 1,
    hi: dc.x + width - 2,
    row,
  }
}

/** Whether a stroke at drawing column `x` meets a plain horizontal border. */
function attachesAt(
  graph: AsciiGraph,
  run: PortRun,
  x: number,
  geo: { lo: number; hi: number; row: number },
): boolean {
  if (x < geo.lo || x > geo.hi) return false
  const dc = run.node.drawingCoord!
  const ch = run.node.drawing![x - dc.x]?.[geo.row]
  return ch === '─' || ch === '-'
}

/** Travel direction of a run: leaving a bottom port or arriving at a top port goes down. */
function travelsDown(run: PortRun, role: 'S' | 'E'): boolean {
  return (role === 'S') === (run.side === 'bottom')
}

interface Slot {
  run: PortRun
  role: 'S' | 'E'
  fixed: boolean
}

/**
 * Work out each edge's port offsets.
 *
 * Edges that leave a port in the same direction (a fan-out), or arrive at it
 * from the same direction (a fan-in), share one trunk by design and keep one
 * column. What collides is a port used both ways at once: an edge leaving and
 * another arriving. Those are drawn apart, the edge travelling down one column
 * right of the port centre and the edge travelling up one column left, the
 * same convention a reciprocal pair already uses (#1284). Ports used one way
 * only keep their routed column exactly.
 */
export function portShifts(graph: AsciiGraph): Map<AsciiEdge, PortShift> {
  const result = new Map<AsciiEdge, PortShift>()
  if (graph.edges.length < 2) return result

  // Slots: one per (port, role). Straight edges tie their two slots together.
  const parent = new Map<string, string>()
  const find = (k: string): string => {
    let root = k
    while (parent.get(root) !== root) root = parent.get(root)!
    parent.set(k, root)
    return root
  }
  const union = (a: string, b: string): void => {
    parent.set(find(a), find(b))
  }

  const slots = new Map<string, Slot>()
  const slotEdges = new Map<string, number>()
  const rolesAt = new Map<string, Set<'S' | 'E'>>()
  const addSlot = (
    node: AsciiNode,
    cell: GridCoord,
    role: 'S' | 'E',
    run: PortRun,
    fixed: boolean,
  ): string => {
    const port = portKey(node, cell)
    const key = `${port}|${role}`
    if (!parent.has(key)) parent.set(key, key)
    slotEdges.set(key, (slotEdges.get(key) ?? 0) + 1)
    const existing = slots.get(key)
    if (!existing || (fixed && !existing.fixed)) {
      slots.set(key, { run, role, fixed })
    }
    const roles = rolesAt.get(port) ?? new Set<'S' | 'E'>()
    roles.add(role)
    rolesAt.set(port, roles)
    return key
  }

  const runs = new Map<AsciiEdge, { r: EdgeRuns; s?: string; e?: string }>()
  for (const edge of graph.edges) {
    if (edge.from === edge.to || edge.path.length < 2) continue
    if (isFixed(edge)) {
      // A bundled or cluster edge stays on its routed column at both ends.
      const first = edge.path[0]!
      const last = edge.path[edge.path.length - 1]!
      const down = last.y > first.y
      const stub = (
        node: AsciiNode,
        cell: GridCoord,
        top: boolean,
      ): PortRun => ({
        col: cell.x,
        from: 0,
        to: 0,
        side: top ? 'top' : 'bottom',
        node,
        cell,
        turn: 0,
      })
      addSlot(edge.from, first, 'S', stub(edge.from, first, !down), true)
      addSlot(edge.to, last, 'E', stub(edge.to, last, down), true)
      continue
    }
    const r = runsOf(edge)
    if (!r) continue
    const entry: { r: EdgeRuns; s?: string; e?: string } = { r }
    if (r.start) {
      entry.s = addSlot(r.start.node, r.start.cell, 'S', r.start, false)
    }
    if (r.end) entry.e = addSlot(r.end.node, r.end.cell, 'E', r.end, false)
    if (r.straight && entry.s && entry.e) union(entry.s, entry.e)
    runs.set(edge, entry)
  }

  // Components of tied slots; a component moves when any of its ports is used
  // both ways, and never when it holds a fixed slot.
  const crowdedPort = (port: string): boolean =>
    (rolesAt.get(port)?.size ?? 0) > 1
  const components = new Map<string, string[]>()
  for (const key of slots.keys()) {
    const root = find(key)
    const list = components.get(root)
    if (list) list.push(key)
    else components.set(root, [key])
  }
  // A reciprocal pair alone on its two ports is drawn apart by `strokeShift`
  // (draw-arrows.ts), which also checks the labels fit; leave it to that.
  const pairOnly = new Set<string>()
  for (const [edge, { r, s, e }] of runs) {
    if (!r.straight || !s || !e) continue
    const other = graph.edges.find(
      (o) => o !== edge && o.from === edge.to && o.to === edge.from,
    )
    const partner = other && runs.get(other)
    if (!partner?.r.straight || !partner.s || !partner.e) continue
    const keys = [s, e, partner.s, partner.e]
    const alone = keys.every((k) => slotEdges.get(k) === 1)
    const ports = new Set(keys.map((k) => k.slice(0, k.lastIndexOf('|'))))
    if (
      alone &&
      ports.size === 2 &&
      keys.every((k) => crowdedPort(k.slice(0, k.lastIndexOf('|'))))
    )
      pairOnly.add(find(s))
  }
  const offsets = new Map<string, number>() // component root -> column offset
  for (const [root, keys] of components) {
    if (pairOnly.has(root)) continue
    const members = keys.map((k) => slots.get(k)!)
    if (members.some((m) => m.fixed)) continue
    const ports = keys.map((k) => k.slice(0, k.lastIndexOf('|')))
    if (!ports.some(crowdedPort)) continue
    const down = travelsDown(members[0]!.run, members[0]!.role)
    // Keep clear of a fixed (bundle or cluster) stroke on the same port.
    const nearFixed = ports.some((port) =>
      [...slots.entries()].some(
        ([k, m]) => m.fixed && k.startsWith(`${port}|`),
      ),
    )
    const magnitude = nearFixed ? STROKE_SPACING : 1
    const offset = down ? magnitude : -magnitude
    const fits = members.every((m) => {
      const geo = portGeometry(graph, m.run)
      return geo !== undefined && attachesAt(graph, m.run, geo.cx + offset, geo)
    })
    if (fits) offsets.set(root, offset)
  }

  for (const [edge, { r, s, e }] of runs) {
    const start = s ? (offsets.get(find(s)) ?? 0) : 0
    const end = e ? (offsets.get(find(e)) ?? 0) : 0
    if (start === 0 && end === 0) continue
    const shift: PortShift = { start, end }
    if (r.start) {
      shift.startRun = { col: r.start.col, from: r.start.from, to: r.start.to }
    }
    if (r.end) {
      shift.endRun = { col: r.end.col, from: r.end.from, to: r.end.to }
    }
    result.set(edge, shift)
  }
  return result
}

/** Per-point drawn-column shift for `edge`'s path, or undefined when unshifted. */
export function edgePointShifts(
  graph: AsciiGraph,
  edge: AsciiEdge,
): number[] | undefined {
  const shift = portShifts(graph).get(edge)
  if (!shift) return undefined
  const shifts = edge.path.map(() => 0)
  if (shift.startRun) {
    for (let i = shift.startRun.from; i <= shift.startRun.to; i++) {
      shifts[i] = shift.start
    }
  }
  if (shift.endRun) {
    for (let i = shift.endRun.from; i <= shift.endRun.to; i++) {
      shifts[i] = shift.end
    }
  }
  return shifts
}

/** `edge`'s label line in drawing space, following any port shift. */
export function labelLineToDrawing(
  graph: AsciiGraph,
  edge: AsciiEdge,
): DrawingCoord[] {
  const base = lineToDrawing(graph, edge.labelLine)
  const shift = portShifts(graph).get(edge)
  if (!shift) return base
  const path = edge.path
  return base.map((dc, i) => {
    const g = edge.labelLine[i]!
    for (const [run, dx] of [
      [shift.startRun, shift.start],
      [shift.endRun, shift.end],
    ] as const) {
      if (!run || g.x !== run.col) continue
      const ys = [path[run.from]!.y, path[run.to]!.y]
      if (g.y >= Math.min(...ys) && g.y <= Math.max(...ys)) {
        return { x: dc.x + dx, y: dc.y }
      }
    }
    return dc
  })
}

/** `edge`'s whole path in drawing space, following any port shift. */
export function pathToDrawing(
  graph: AsciiGraph,
  edge: AsciiEdge,
): DrawingCoord[] {
  const base = lineToDrawing(graph, edge.path)
  const shifts = edgePointShifts(graph, edge)
  if (!shifts) return base
  return base.map((dc, i) => ({ x: dc.x + shifts[i]!, y: dc.y }))
}
