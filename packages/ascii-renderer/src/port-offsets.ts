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
// Mermaid draws each edge as its own path. Here an edge that shares a port
// with an edge going the other way is drawn one cell to the side of the port
// centre: a column left or right on the top and bottom sides, a row up or down
// on the left and right sides. The offset applies to the run of the path that
// touches the port (the first run for the source end, the last for the target
// end); everything past the first bend is left where the router put it, so the
// run just shifts sideways and the next segment starts from the shifted corner.
//
// Edges that leave a port in the same direction, or arrive from the same
// direction, share one trunk by design (fan-out, fan-in) and keep one position;
// only a port used both ways at once is split. Edges that run straight from one
// port to another need one position at both ends, so their two ports are tied.
// Edges in a bundle, lane edges, cluster edges and self-loops keep their routed
// geometry and count as fixed occupants of the position they use.
// ============================================================================

import type { AsciiEdge, AsciiGraph, AsciiNode, GridCoord } from './types.ts'
import { gridToDrawingCoord, lineToDrawing } from './grid.ts'
import type { DrawingCoord } from './types.ts'

/** Cells between a fixed stroke and a moved one (one blank cell). */
const STROKE_SPACING = 2

/** A run of an edge's path along one axis that touches a node port. */
interface PortRun {
  /** `v` runs along a column (x offsets), `h` along a row (y offsets). */
  axis: 'v' | 'h'
  /** Grid column (`v`) or row (`h`) the run sits on. */
  line: number
  /** Index of its first and last path point. */
  from: number
  to: number
  /** Which side of the node it leaves from / arrives at. */
  side: 'top' | 'bottom' | 'left' | 'right'
  node: AsciiNode
  /** Cell in the node's block where the run touches the port. */
  cell: GridCoord
  /**
   * Direction the path moves across the run's axis next to the run: the
   * first move after a source run, the last move into a target run. -1, 0
   * (none) or 1 in grid units (x for `v`, y for `h`).
   */
  turn: -1 | 0 | 1
}

interface EdgeRuns {
  start?: PortRun
  end?: PortRun
  /** Straight edge: one run covers the whole path, so one offset serves both. */
  straight: boolean
}

/** Where a shifted run lies, for mapping path and label-line points. */
export interface ShiftedRun {
  axis: 'v' | 'h'
  line: number
  from: number
  to: number
}

/** Drawn-cell shift of the first and last run of an edge's path. */
export interface PortShift {
  start: number
  end: number
  startRun?: ShiftedRun
  endRun?: ShiftedRun
}

const portKey = (node: AsciiNode, cell: GridCoord): string =>
  `${node.index}|${cell.x},${cell.y}`

function isFixed(edge: AsciiEdge): boolean {
  return (
    edge.from === edge.to ||
    edge.path.length < 2 ||
    edge.bundle !== undefined ||
    edge.parallelLane !== undefined ||
    edge.style === 'invisible' ||
    edge.clusterSource !== undefined ||
    edge.clusterTarget !== undefined
  )
}

const sign = (n: number): -1 | 0 | 1 => (n > 0 ? 1 : n < 0 ? -1 : 0)

/** The run that starts the path at `from` (index 0) going toward index 1. */
function startRun(edge: AsciiEdge): PortRun | undefined {
  const p = edge.path
  const last = p.length - 1
  const a = p[0]!
  const b = p[1]!
  if (b.x === a.x && b.y !== a.y) {
    let end = 1
    while (end + 1 <= last && p[end + 1]!.x === a.x) end++
    const next = p[end + 1]
    return {
      axis: 'v',
      line: a.x,
      from: 0,
      to: end,
      side: b.y > a.y ? 'bottom' : 'top',
      node: edge.from,
      cell: a,
      turn: next ? sign(next.x - a.x) : 0,
    }
  }
  if (b.y === a.y && b.x !== a.x) {
    let end = 1
    while (end + 1 <= last && p[end + 1]!.y === a.y) end++
    const next = p[end + 1]
    return {
      axis: 'h',
      line: a.y,
      from: 0,
      to: end,
      side: b.x > a.x ? 'right' : 'left',
      node: edge.from,
      cell: a,
      turn: next ? sign(next.y - a.y) : 0,
    }
  }
  return undefined
}

/** The run that ends the path at the target, going into the last point. */
function endRun(edge: AsciiEdge): PortRun | undefined {
  const p = edge.path
  const last = p.length - 1
  const z = p[last]!
  const y = p[last - 1]!
  if (y.x === z.x && y.y !== z.y) {
    let start = last - 1
    while (start - 1 >= 0 && p[start - 1]!.x === z.x) start--
    const before = p[start - 1]
    return {
      axis: 'v',
      line: z.x,
      from: start,
      to: last,
      side: z.y > y.y ? 'top' : 'bottom',
      node: edge.to,
      cell: z,
      // Which side the path came in from: an edge arriving from the right.
      turn: before ? sign(z.x - before.x) : 0,
    }
  }
  if (y.y === z.y && y.x !== z.x) {
    let start = last - 1
    while (start - 1 >= 0 && p[start - 1]!.y === z.y) start--
    const before = p[start - 1]
    return {
      axis: 'h',
      line: z.y,
      from: start,
      to: last,
      side: z.x > y.x ? 'left' : 'right',
      node: edge.to,
      cell: z,
      turn: before ? sign(z.y - before.y) : 0,
    }
  }
  return undefined
}

function runsOf(edge: AsciiEdge): EdgeRuns | undefined {
  const start = startRun(edge)
  const end = endRun(edge)
  if (!start && !end) return undefined
  const last = edge.path.length - 1
  const straight =
    start !== undefined &&
    end !== undefined &&
    start.to === last &&
    end.from === 0
  const result: EdgeRuns = { straight }
  if (start) result.start = start
  if (end) result.end = end
  return result
}

interface Geometry {
  /** Drawing coordinate of the port centre along the run's offset axis. */
  centre: number
  /** Furthest cells along that axis a stroke may meet the node's border. */
  lo: number
  hi: number
  /** Index, within the node's drawing, of the border row (`v`) / column (`h`). */
  border: number
}

function portGeometry(graph: AsciiGraph, run: PortRun): Geometry | undefined {
  const node = run.node
  const dc = node.drawingCoord
  const drawing = node.drawing
  if (!dc || !drawing) return undefined
  const width = drawing.length
  const height = drawing[0]?.length ?? 0
  const centre = gridToDrawingCoord(graph, run.cell)
  if (run.axis === 'v') {
    if (width < 3 || height < 1) return undefined
    return {
      centre: centre.x,
      lo: dc.x + 1,
      hi: dc.x + width - 2,
      border: run.side === 'top' ? 0 : height - 1,
    }
  }
  if (height < 3 || width < 1) return undefined
  return {
    centre: centre.y,
    lo: dc.y + 1,
    hi: dc.y + height - 2,
    border: run.side === 'left' ? 0 : width - 1,
  }
}

/** Whether a stroke at `pos` along the offset axis meets a plain border. */
function attachesAt(run: PortRun, pos: number, geo: Geometry): boolean {
  if (pos < geo.lo || pos > geo.hi) return false
  const dc = run.node.drawingCoord!
  const drawing = run.node.drawing!
  if (run.axis === 'v') {
    const ch = drawing[pos - dc.x]?.[geo.border]
    return ch === '─' || ch === '-'
  }
  const ch = drawing[geo.border]?.[pos - dc.y]
  return ch === '│' || ch === '|'
}

/**
 * Which way a slot is pushed. Along a column, an edge travelling down sits
 * right of centre and one travelling up sits left (the #1284 pair convention).
 * Along a row, a bent edge sits on the side it turns toward, so it does not
 * cross its neighbours: a source run goes to the row its first turn heads
 * for, and a target run to the row opposite the way it came in from. A straight
 * run follows its travel direction.
 */
function pushOf(run: PortRun, role: 'S' | 'E'): 1 | -1 {
  if (run.axis === 'v') {
    return (role === 'S') === (run.side === 'bottom') ? 1 : -1
  }
  if (run.turn !== 0) return role === 'S' ? run.turn : (-run.turn as 1 | -1)
  return (role === 'S') === (run.side === 'right') ? 1 : -1
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
 * position. What collides is a port used both ways at once: an edge leaving and
 * another arriving. Those are drawn apart by one cell either side of the port
 * centre (see `pushOf`). Ports used one way only keep their routed position
 * exactly.
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
      // A bundled, lane or cluster edge stays where it was routed, at both
      // ends; without a run of its own it still occupies its ports.
      const s = startRun(edge)
      const e = endRun(edge)
      if (s) addSlot(edge.from, edge.path[0]!, 'S', s, true)
      if (e) addSlot(edge.to, edge.path[edge.path.length - 1]!, 'E', e, true)
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
  const portOf = (key: string): string => key.slice(0, key.lastIndexOf('|'))
  const crowdedPort = (port: string): boolean =>
    (rolesAt.get(port)?.size ?? 0) > 1
  const components = new Map<string, string[]>()
  for (const key of slots.keys()) {
    const root = find(key)
    const list = components.get(root)
    if (list) list.push(key)
    else components.set(root, [key])
  }
  // A straight reciprocal pair alone on its two ports is drawn apart by
  // `strokeShift` (draw-arrows.ts), which also checks the labels fit, or by
  // the lane mechanism of #629; leave it to those.
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
    const ports = new Set(keys.map(portOf))
    if (
      alone &&
      ports.size === 2 &&
      keys.every((k) => crowdedPort(portOf(k)))
    ) {
      pairOnly.add(find(s))
    }
  }

  const offsets = new Map<string, number>() // component root -> offset
  for (const [root, keys] of components) {
    if (pairOnly.has(root)) continue
    const members = keys.map((k) => slots.get(k)!)
    if (members.some((m) => m.fixed)) continue
    const ports = keys.map(portOf)
    if (!ports.some(crowdedPort)) continue
    // Keep clear of a fixed stroke on the same port.
    const nearFixed = ports.some((port) =>
      [...slots.entries()].some(
        ([k, m]) => m.fixed && k.startsWith(`${port}|`),
      ),
    )
    const magnitude = nearFixed ? STROKE_SPACING : 1
    const offset = pushOf(members[0]!.run, members[0]!.role) * magnitude
    const fits = members.every((m) => {
      const geo = portGeometry(graph, m.run)
      return geo !== undefined && attachesAt(m.run, geo.centre + offset, geo)
    })
    if (fits) offsets.set(root, offset)
  }

  const shiftedRun = (run: PortRun): ShiftedRun => ({
    axis: run.axis,
    line: run.line,
    from: run.from,
    to: run.to,
  })
  for (const [edge, { r, s, e }] of runs) {
    const start = s ? (offsets.get(find(s)) ?? 0) : 0
    const end = e ? (offsets.get(find(e)) ?? 0) : 0
    if (start === 0 && end === 0) continue
    const shift: PortShift = { start, end }
    if (r.start) shift.startRun = shiftedRun(r.start)
    if (r.end) shift.endRun = shiftedRun(r.end)
    result.set(edge, shift)
  }
  return result
}

/** Per-point drawn shift for `edge`'s path, or undefined when unshifted. */
export function edgePointShifts(
  graph: AsciiGraph,
  edge: AsciiEdge,
): DrawingCoord[] | undefined {
  const shift = portShifts(graph).get(edge)
  if (!shift) return undefined
  const shifts: DrawingCoord[] = edge.path.map(() => ({ x: 0, y: 0 }))
  for (const [run, by] of [
    [shift.startRun, shift.start],
    [shift.endRun, shift.end],
  ] as const) {
    if (!run) continue
    for (let i = run.from; i <= run.to; i++) {
      if (run.axis === 'v') shifts[i]!.x = by
      else shifts[i]!.y = by
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
    for (const [run, by] of [
      [shift.startRun, shift.start],
      [shift.endRun, shift.end],
    ] as const) {
      if (!run) continue
      const a = path[run.from]!
      const b = path[run.to]!
      if (run.axis === 'v') {
        if (
          g.x === run.line &&
          g.y >= Math.min(a.y, b.y) &&
          g.y <= Math.max(a.y, b.y)
        ) {
          return { x: dc.x + by, y: dc.y }
        }
      } else if (
        g.y === run.line &&
        g.x >= Math.min(a.x, b.x) &&
        g.x <= Math.max(a.x, b.x)
      ) {
        return { x: dc.x, y: dc.y + by }
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
  return base.map((dc, i) => ({
    x: dc.x + shifts[i]!.x,
    y: dc.y + shifts[i]!.y,
  }))
}
