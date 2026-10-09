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
// only a port used both ways at once is split. The exception is a fan-out
// whose edges bend the same way at different distances from the port: the
// nearer bend would run along the whole stem of the farther one, so each
// distinct distance gets a stem of its own (#1308, `staggerFanOuts`).
// Edges that run straight from one
// port to another need one position at both ends, so their two ports are tied.
// Edges in a bundle, lane edges, cluster edges and self-loops keep their routed
// geometry and count as fixed occupants of the position they use.
// ============================================================================

import type { AsciiEdge, AsciiGraph, AsciiNode, GridCoord } from './types.ts'
import { gridToDrawingCoord, lineToDrawing } from './grid.ts'
import type { DrawingCoord } from './types.ts'
import { isPortFixedEdge } from './edge-cell-styles.ts'

/** Cells between a fixed stroke and a moved one (one blank cell). */
const STROKE_SPACING = 2

/** Widest cell offset from the port centre for a stroke split off a shared port. */
const PAIR_SPREAD = 2

/** A run of an edge's path along one axis that touches a node port. */
export interface PortRun {
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
  /** Extra drawn shift per path point (a fan-in's leg moved to its own row). */
  points?: DrawingCoord[]
}

const portKey = (node: AsciiNode, cell: GridCoord): string =>
  `${node.index}|${cell.x},${cell.y}`

const isFixed = isPortFixedEdge

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
  if (run.turn !== 0) {
    // Two bent edges between the same pair nest like L shapes. The column
    // convention puts the down-travelling edge on the outer (right) column
    // of a right-hand route, and the outer route must take the upper row to
    // avoid crossing the inner one, so on the right side the row is opposite
    // the adjacent leg's motion; on the left side the columns mirror, and so
    // does this.
    return run.side === 'right' ? (-run.turn as 1 | -1) : run.turn
  }
  return (role === 'S') === (run.side === 'right') ? 1 : -1
}

/** An edge leaving a port, for `staggerFanOuts`. */
export interface FanOutMember {
  edge: AsciiEdge
  run: PortRun
  /** The run is the whole edge: it goes straight to its target. */
  straight: boolean
}

/** How far the run travels from the port, in grid cells. */
function runExtent(edge: AsciiEdge, run: PortRun): number {
  const a = edge.path[run.from]!
  const b = edge.path[run.to]!
  return run.axis === 'v' ? Math.abs(b.y - a.y) : Math.abs(b.x - a.x)
}

/**
 * Give the edges of a fan-out that bend the same way at different distances a
 * stem each (#1308). They leave one port in one direction, so the nearer bend
 * would otherwise ride the whole stem of the farther one and the two cannot be
 * told apart. The farthest bend keeps `base`, the position the port gives the
 * slot; each nearer distance steps one stroke spacing further toward the side
 * it bends to, which keeps its turn clear of the stems it leaves behind. A
 * straight edge out of the same port counts as the farthest and keeps `base`.
 *
 * Edges bending the other way keep sharing the base stem (the usual tree), as
 * do edges that bend at the same distance. A group whose stems do not all
 * land on the node's border, or would land within a stroke spacing of another
 * edge at this port (`taken`, as offsets), is left sharing one stem.
 */
export function staggerFanOuts(
  graph: AsciiGraph,
  members: readonly FanOutMember[],
  base: number,
  taken: readonly number[],
  out: Map<AsciiEdge, number>,
): void {
  // One port cell can start edges out of different sides of the node (a corner
  // cell serves two); only edges leaving the same side share a stem, so group
  // by side before comparing bends or looking for a straight anchor.
  for (const side of ['top', 'bottom', 'left', 'right'] as const) {
    const group = members.filter((m) => m.run.side === side)
    const anchored = group.some((m) => m.straight)
    for (const turn of [-1, 1] as const) {
      const bent = group.filter((m) => !m.straight && m.run.turn === turn)
      const extents = [...new Set(bent.map((m) => runExtent(m.edge, m.run)))]
      extents.sort((a, b) => b - a)
      if (extents.length + (anchored ? 1 : 0) < 2) continue
      const offsetOf = (extent: number): number =>
        base +
        turn * STROKE_SPACING * (extents.indexOf(extent) + (anchored ? 1 : 0))
      const geo = portGeometry(graph, bent[0]!.run)
      const fits =
        geo !== undefined &&
        extents.every((x) => {
          const offset = offsetOf(x)
          return (
            attachesAt(bent[0]!.run, geo.centre + offset, geo) &&
            taken.every((t) => Math.abs(t - offset) >= STROKE_SPACING)
          )
        })
      if (!fits) continue
      for (const m of bent) out.set(m.edge, offsetOf(runExtent(m.edge, m.run)))
    }
  }
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
  return scopedShifts.get(graph) ?? computePortShifts(graph)
}

/**
 * `portShifts` is O(E²) and label placement asks for it once per candidate,
 * so a draw pass would repeat it many times over an unchanged layout. Within
 * `withPortShifts` the result is computed once; outside it nothing is cached,
 * so a later re-route can never see a stale map.
 */
const scopedShifts = new WeakMap<AsciiGraph, Map<AsciiEdge, PortShift>>()

export function withPortShifts<T>(graph: AsciiGraph, run: () => T): T {
  if (scopedShifts.has(graph)) return run()
  scopedShifts.set(graph, computePortShifts(graph))
  try {
    return run()
  } finally {
    scopedShifts.delete(graph)
  }
}

function computePortShifts(graph: AsciiGraph): Map<AsciiEdge, PortShift> {
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
  const startGroups = new Map<string, FanOutMember[]>()
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
      const group = startGroups.get(entry.s) ?? []
      group.push({ edge, run: r.start, straight: r.straight })
      startGroups.set(entry.s, group)
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
    // Prefer a wide split so the two strokes of a reciprocal pair read as two
    // edges (#1400); settle for a narrower one where the port is too short.
    const push = pushOf(members[0]!.run, members[0]!.role)
    // A port that also fans out keeps the narrow split: `staggerFanOuts`
    // spaces its stems from this offset (#1308).
    const fansOut = ports.some((port) =>
      [...slotEdges].some(([k, n]) => n > 1 && portOf(k) === port),
    )
    const magnitudes =
      nearFixed || fansOut
        ? [nearFixed ? STROKE_SPACING : 1]
        : Array.from({ length: PAIR_SPREAD }, (_, i) => PAIR_SPREAD - i)
    const offset = magnitudes
      .map((m) => push * m)
      .find((o) =>
        members.every((m) => {
          const geo = portGeometry(graph, m.run)
          return geo !== undefined && attachesAt(m.run, geo.centre + o, geo)
        }),
      )
    if (offset !== undefined) offsets.set(root, offset)
  }

  const shiftedRun = (run: PortRun): ShiftedRun => ({
    axis: run.axis,
    line: run.line,
    from: run.from,
    to: run.to,
  })
  const slotOffset = (key: string): number => offsets.get(find(key)) ?? 0
  const staggered = new Map<AsciiEdge, number>()
  for (const [key, members] of startGroups) {
    if (members.length < 2 || slots.get(key)!.fixed) continue
    const port = portOf(key)
    const taken = [...slots.keys()]
      .filter((k) => k !== key && portOf(k) === port)
      .map(slotOffset)
    staggerFanOuts(graph, members, slotOffset(key), taken, staggered)
  }

  const split = splitLabeledArrivals(runs)
  const spread = spreadParallelEdges(runs, rolesAt, portOf)
  const landings = separateFanIns(
    graph,
    runs,
    slots,
    slotEdges,
    rolesAt,
    portOf,
  )

  for (const [edge, { r, s, e }] of runs) {
    const own = spread.get(edge)
    const lane = landings.get(edge)
    const start =
      own ?? lane?.start ?? staggered.get(edge) ?? (s ? slotOffset(s) : 0)
    const end =
      own ??
      lane?.end ??
      split.get(edge) ??
      (e ? (offsets.get(find(e)) ?? 0) : 0)
    if (start === 0 && end === 0 && !lane?.points) continue
    const shift: PortShift = { start, end }
    if (lane?.points) shift.points = lane.points
    if (r.start) shift.startRun = shiftedRun(r.start)
    if (r.end) shift.endRun = shiftedRun(r.end)
    result.set(edge, shift)
  }
  return result
}

/** Where a fan-in edge lands and which row its last leg runs along. */
interface Landing {
  /** Drawn x shift of the stem into the target (and of a straight edge's start). */
  end: number
  start?: number
  /** Extra shift per path point, moving the leg to its own row. */
  points?: DrawingCoord[]
}

type RunEntry = { r: EdgeRuns; s?: string; e?: string }

/**
 * Give unbundled edges into one node from different sources a stroke and an
 * arrowhead each (#1436), the way Mermaid draws them. Such edges used to share
 * a leg along the row above the node and merge into one arrowhead, so none
 * could be followed. A port with two or more of them on its top face is split:
 * stems land a stroke spacing apart, ordered left to right by where each edge
 * comes from so none cross, and bent edges from the same side take a row each,
 * the nearer lane on the upper row. A group is left merged when it would not
 * fit the node's width or the rows between the layers.
 */
function separateFanIns(
  graph: AsciiGraph,
  runs: ReadonlyMap<AsciiEdge, RunEntry>,
  slots: ReadonlyMap<string, Slot>,
  slotEdges: ReadonlyMap<string, number>,
  rolesAt: ReadonlyMap<string, Set<'S' | 'E'>>,
  portOf: (key: string) => string,
): Map<AsciiEdge, Landing> {
  const groups = new Map<string, AsciiEdge[]>()
  for (const [edge, { r, e }] of runs) {
    if (!e || r.end?.axis !== 'v' || r.end.side !== 'top') continue
    const group = groups.get(e) ?? []
    group.push(edge)
    groups.set(e, group)
  }
  const out = new Map<AsciiEdge, Landing>()
  for (const [key, group] of groups) {
    const port = portOf(key)
    if (group.length < 2 || rolesAt.get(port)!.size > 1) continue
    if ([...slots].some(([k, m]) => m.fixed && portOf(k) === port)) continue
    if (new Set(group.map((g) => g.from)).size < 2) continue
    landFanIn(graph, runs, slotEdges, rolesAt, portOf, group, out)
  }
  return out
}

function landFanIn(
  graph: AsciiGraph,
  runs: ReadonlyMap<AsciiEdge, RunEntry>,
  slotEdges: ReadonlyMap<string, number>,
  rolesAt: ReadonlyMap<string, Set<'S' | 'E'>>,
  portOf: (key: string) => string,
  group: AsciiEdge[],
  out: Map<AsciiEdge, Landing>,
): void {
  // Which side each edge comes from, and how far its lane is from the port.
  const info = group.map((edge) => {
    const { r } = runs.get(edge)!
    const end = r.end!
    const p = edge.path
    const before = p[end.from - 1]
    const lane = p[end.from - 2]
    const bent = !r.straight && before !== undefined
    const from = bent ? sign(before.x - end.cell.x) : 0
    return {
      edge,
      r,
      end,
      bent,
      from,
      dist: bent ? Math.abs(before.x - end.cell.x) : 0,
      lane,
    }
  })
  for (const m of info) {
    if (!m.bent) continue
    const k = m.edge.path[m.end.from]!
    const l = m.edge.path[m.end.from - 1]!
    // Only a plain lane, leg and stem can move: a vertical lane into a
    // horizontal leg into the stem.
    if (l.y !== k.y || m.from === 0 || m.lane?.x !== l.x) return
  }
  const order = [
    ...info.filter((m) => m.from < 0).sort((a, b) => b.dist - a.dist),
    ...info.filter((m) => m.from === 0),
    ...info.filter((m) => m.from > 0).sort((a, b) => a.dist - b.dist),
  ]
  const geo = portGeometry(graph, order[0]!.end)
  // A straight edge moves with both its ends, so its source port must be
  // used by it alone.
  const startOk = (m: (typeof order)[number], o: number): boolean => {
    const key = runs.get(m.edge)!.s!
    const st = m.r.start!
    const g = portGeometry(graph, st)
    return (
      g !== undefined &&
      slotEdges.get(key) === 1 &&
      rolesAt.get(portOf(key))!.size === 1 &&
      attachesAt(st, g.centre + o, g)
    )
  }
  const n = order.length
  const spacings: number[][] = [
    order.map((_, i) => STROKE_SPACING * (i - (n - 1) / 2)),
  ]
  const at = order.findIndex((m) => !m.bent)
  if (at >= 0) spacings.push(order.map((_, i) => STROKE_SPACING * (i - at)))
  const offs =
    geo &&
    spacings.find((os) =>
      order.every(
        (m, i) =>
          Number.isInteger(os[i]) &&
          attachesAt(m.end, geo.centre + os[i]!, geo) &&
          (m.bent || os[i] === 0 || startOk(m, os[i]!)),
      ),
    )
  if (!offs) return

  // Rows: bent edges from one side take a row each, stacked up from the one
  // just above the arrowheads, the nearer lane highest. Sitting low keeps the
  // legs clear of the sources' own legs in the gap above.
  const borderY = order[0]!.end.node.drawingCoord!.y
  const dys = new Map<AsciiEdge, number>()
  for (const side of [-1, 1]) {
    const mine = order.filter((m) => m.bent && m.from === side)
    mine.sort((a, b) => a.dist - b.dist)
    for (const [i, m] of mine.entries()) {
      const row =
        borderY - STROKE_SPACING - STROKE_SPACING * (mine.length - 1 - i)
      const was = gridToDrawingCoord(graph, m.edge.path[m.end.from]!).y
      const dy = row - was
      const top = gridToDrawingCoord(graph, m.lane!).y + STROKE_SPACING
      // Stay out of a frame the leg was not already inside.
      const inFrame = (y: number): boolean =>
        graph.subgraphs.some((sg) => y > sg.minY && y < sg.maxY)
      if (row < top || (inFrame(row) && !inFrame(was))) return
      dys.set(m.edge, dy)
    }
  }
  order.forEach((m, i) => {
    const o = offs[i]!
    const dy = dys.get(m.edge)
    if (dy === undefined) {
      out.set(m.edge, { end: o, start: o })
      return
    }
    const points = m.edge.path.map(() => ({ x: 0, y: 0 }))
    points[m.end.from - 1]!.y = dy
    points[m.end.from]!.y = dy
    out.set(m.edge, { end: o, points })
  })
}

/**
 * Draw parallel edges (same ordered pair, unlabeled, each a straight run
 * between the same two ports, used by nothing else) side by side on the two
 * faces, one stroke spacing apart and centred on the port (#1394). A group
 * whose strokes would not all land on a plain border stays on one position.
 */
function spreadParallelEdges(
  runs: ReadonlyMap<AsciiEdge, { r: EdgeRuns; s?: string; e?: string }>,
  rolesAt: ReadonlyMap<string, Set<'S' | 'E'>>,
  portOf: (key: string) => string,
): Map<AsciiEdge, number> {
  const groups = new Map<string, AsciiEdge[]>()
  for (const [edge, { r, s, e }] of runs) {
    if (!r.straight || !s || !e || edge.text.length > 0) continue
    const key = `${s}>${e}`
    const group = groups.get(key) ?? []
    group.push(edge)
    groups.set(key, group)
  }
  const out = new Map<AsciiEdge, number>()
  for (const group of groups.values()) {
    const first = runs.get(group[0]!)!
    const shared = [first.s!, first.e!].some(
      (k) => rolesAt.get(portOf(k))!.size > 1,
    )
    if (group.length < 2 || shared) continue
    const offsetOf = (i: number): number =>
      STROKE_SPACING * i - STROKE_SPACING * ((group.length - 1) / 2)
    // `spreadsOnFaces` (edge-routing.ts) already checked the faces are wide
    // enough, and every node shape keeps a plain border across its width.
    group.forEach((edge, i) => out.set(edge, offsetOf(i)))
  }
  return out
}

/**
 * Give labeled edges that reach one port from opposite sides a stroke each.
 * One arriving from the left and one from the right of a vertical run meet in
 * the port's column and read as one edge with one label (#1399): each moves a
 * cell toward the side it comes from, so neither crosses the other. Unlabeled
 * edges keep sharing one trunk.
 */
function splitLabeledArrivals(
  runs: ReadonlyMap<AsciiEdge, { r: EdgeRuns; s?: string; e?: string }>,
): Map<AsciiEdge, number> {
  const byPort = new Map<string, { edge: AsciiEdge; run: PortRun }[]>()
  for (const [edge, { r, e }] of runs) {
    if (!e || r.end?.axis !== 'v' || r.straight) continue
    const group = byPort.get(e) ?? []
    group.push({ edge, run: r.end })
    byPort.set(e, group)
  }
  const out = new Map<AsciiEdge, number>()
  for (const group of byPort.values()) {
    const labeled = (turn: number): boolean =>
      group.some((m) => m.run.turn === turn && m.edge.text.length > 0)
    if (!labeled(-1) || !labeled(1)) continue
    for (const m of group) out.set(m.edge, -m.run.turn)
  }
  return out
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
  shift.points?.forEach((pt, i) => {
    shifts[i]!.x += pt.x
    shifts[i]!.y += pt.y
  })
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
    // A corner can lie on two runs at once (a vertical start run and a
    // horizontal end run meet at the bend), each shifting a different axis,
    // so every matching run applies. Stopping at the first left a label on
    // the unshifted row of its own stroke (#attribution).
    // At most one shift per axis: a straight edge's start and end runs are
    // one run, and applying its offset twice would double it.
    let x = dc.x
    let y = dc.y
    let shiftedX = false
    let shiftedY = false
    for (const [run, by] of [
      [shift.startRun, shift.start],
      [shift.endRun, shift.end],
    ] as const) {
      if (!run) continue
      const a = path[run.from]!
      const b = path[run.to]!
      if (run.axis === 'v') {
        if (
          !shiftedX &&
          g.x === run.line &&
          g.y >= Math.min(a.y, b.y) &&
          g.y <= Math.max(a.y, b.y)
        ) {
          x += by
          shiftedX = true
        }
      } else if (
        !shiftedY &&
        g.y === run.line &&
        g.x >= Math.min(a.x, b.x) &&
        g.x <= Math.max(a.x, b.x)
      ) {
        y += by
        shiftedY = true
      }
    }
    const j = path.findIndex((q) => q.x === g.x && q.y === g.y)
    const extra = j >= 0 ? shift.points?.[j] : undefined
    return { x: x + (extra?.x ?? 0), y: y + (extra?.y ?? 0) }
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
