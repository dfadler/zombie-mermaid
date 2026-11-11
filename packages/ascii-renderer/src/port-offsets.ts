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
import { dirEquals, Left, requireGridCoord, Up } from './types.ts'
import { isPortFixedEdge } from './edge-cell-styles.ts'
import { clusterLaneEndShift } from './cluster-boundary.ts'
import { runsAlong, segmentsOf } from './grid-occupancy.ts'
import {
  denseFacingPair,
  flowLanePolyline,
  flowLaneOf,
  leavesFlowFace,
  leavesRightFace,
  loopStartsLow,
} from './edge-routing.ts'

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
  /** The size this edge's gap needs for every jog in it to have a row of its own (#2888). */
  jogGap?: { line: number; size: number }
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
function attachesAt(
  run: PortRun,
  pos: number,
  geo: Geometry,
  /** A diamond's slanted face takes a stroke too (`spreadDiamondFaces`). */
  diamond = false,
  /** A stroke beside a diamond's two-cell vertex leans on the slant (#2918). */
  beside = false,
): boolean {
  if (pos < geo.lo || pos > geo.hi) return false
  const dc = run.node.drawingCoord!
  const drawing = run.node.drawing!
  if (run.axis === 'v') {
    const col = drawing[pos - dc.x]
    const ch = col?.[geo.border]
    // A diamond's vertex is two cells wide: a stroke beside it leans on the
    // slant one row in.
    const near = col?.[geo.border + (run.side === 'top' ? 1 : -1)]
    return (
      ch === '─' ||
      ch === '-' ||
      ch === '╲' ||
      ch === '╱' ||
      (beside && (near === '╲' || near === '╱'))
    )
  }
  // A slanted side (parallelogram, #2492) leaves blanks between the border
  // column and its glyph: take the first glyph met walking inward.
  const step = run.side === 'left' ? 1 : -1
  let ch: string | undefined = ' '
  for (let x = geo.border; ch === ' ' && drawing[x]; x += step)
    ch = drawing[x]![pos - dc.y]
  const slant =
    run.node.shape.startsWith('parallelogram') ||
    (diamond && run.node.shape === 'diamond')
  return ch === '│' || ch === '|' || (slant && (ch === '╱' || ch === '╲'))
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
    // Edges of different line styles cannot share a stem (one glyph per cell),
    // so each (distance, style) pair takes a stem of its own.
    const mixed = new Set(group.map((m) => m.edge.style)).size > 1
    const keyOf = (m: FanOutMember): string =>
      mixed
        ? `${runExtent(m.edge, m.run)}|${m.edge.style}`
        : String(runExtent(m.edge, m.run))
    for (const turn of [-1, 1] as const) {
      const bent = group.filter((m) => !m.straight && m.run.turn === turn)
      const extents = [...new Set(bent.map(keyOf))]
      extents.sort((a, b) => parseInt(b) - parseInt(a))
      // With no straight stem, mixed styles split the two turns a cell each
      // side of the port so a left and a right bend do not share one.
      const apart = mixed && !anchored
      if (extents.length === 0) continue
      if (!apart && extents.length + (anchored ? 1 : 0) < 2) continue
      const offsetOf = (key: string): number =>
        apart
          ? base + turn * (extents.indexOf(key) + 1) * (STROKE_SPACING / 2)
          : base +
            turn * STROKE_SPACING * (extents.indexOf(key) + (anchored ? 1 : 0))
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
      for (const m of bent) out.set(m.edge, offsetOf(keyOf(m)))
    }
  }
}

/**
 * An LR fan-out leaves the source's right face on a row of its own per edge,
 * as Mermaid does: a target above takes the row above the centre, one level
 * with the source keeps the centre, one below takes the row below. A shared
 * stem would read as one edge splitting, and could not carry two line styles.
 * Returns false (leaving the stems to `staggerFanOuts`) when two targets lie
 * the same side or the face has no room.
 */
// ponytail: one row per side, so a source with two targets above keeps the shared stem.
function spreadRightFan(
  graph: AsciiGraph,
  members: readonly FanOutMember[],
  out: Map<AsciiEdge, number>,
  taken: readonly number[],
): boolean {
  if (
    members.some((m) => m.run.side !== 'right') ||
    !members.some((m) =>
      leavesRightFace(graph, m.edge, graph.config.graphDirection),
    )
  ) {
    return false
  }
  const rowOf = (m: FanOutMember): number =>
    Math.sign(requireGridCoord(m.edge.to).y - requireGridCoord(m.edge.from).y)
  const rows = members.map(rowOf)
  const geo = portGeometry(graph, members[0]!.run)
  if (
    new Set(rows).size !== rows.length ||
    !geo ||
    !rows.every((o) => attachesAt(members[0]!.run, geo.centre + o, geo)) ||
    // A back edge into the same face holds its own row: leave the group to
    // `staggerFanOuts`, which keeps clear of `taken`.
    rows.some((o) => taken.includes(o))
  ) {
    return false
  }
  members.forEach((m, i) => out.set(m.edge, rows[i]!))
  return true
}

/**
 * The edges on a diamond's right face in LR (a decision's branches and a
 * return edge into it) each take a cell of the slanted face, ordered by where
 * their other end lies, as Mermaid spreads its ports: two take the upper and
 * lower slant, three add the vertex. Beyond three the face keeps the shared
 * stems.
 */
function spreadDiamondFaces(
  graph: AsciiGraph,
  runs: ReadonlyMap<AsciiEdge, RunEntry>,
): Map<AsciiEdge, { start?: number; end?: number }> {
  const out = new Map<AsciiEdge, { start?: number; end?: number }>()
  const dir = graph.config.graphDirection
  // BT is TD drawn flipped: its flow face is the bottom one here too.
  const flowSide = dir === 'LR' ? 'right' : 'bottom'
  const crossOf = (n: AsciiNode): number =>
    dir === 'LR' ? requireGridCoord(n).y : requireGridCoord(n).x
  interface Use {
    edge: AsciiEdge
    role: 'start' | 'end'
    y: number
    run: PortRun
  }
  const faces = new Map<AsciiNode, Use[]>()
  const add = (run: PortRun | undefined, u: Omit<Use, 'run'>): void => {
    if (!run || run.node.shape !== 'diamond' || run.side !== flowSide) return
    faces.set(run.node, [...(faces.get(run.node) ?? []), { ...u, run }])
  }
  for (const [edge, { r }] of runs) {
    add(r.start, {
      edge,
      role: 'start',
      y: crossOf(edge.to),
    })
    add(r.end, {
      edge,
      role: 'end',
      y: crossOf(edge.from),
    })
  }
  for (const uses of faces.values()) {
    // A decision with no return keeps its branches on the shared stem.
    if (
      uses.length < 2 ||
      uses.length > 3 ||
      !(
        // A return edge into a vertical-flow vertex keeps its own routing (#1284).
        (dir === 'LR' && uses.some((u) => u.role === 'end')) ||
        uses.some((u) =>
          uses.some(
            (v) =>
              v !== u &&
              v.role === 'start' &&
              u.role === 'start' &&
              v.edge.to === u.edge.to,
          ),
        )
      )
    )
      continue
    const geo = portGeometry(graph, uses[0]!.run)
    const rows = uses.length === 2 ? [-1, 1] : [-1, 0, 1]
    if (
      !geo ||
      !rows.every(
        (o) =>
          o === 0 || attachesAt(uses[0]!.run, geo.centre + o, geo, true, true),
      )
    )
      continue
    uses
      .sort((a, b) => a.y - b.y || (a.role === 'start' ? -1 : 1))
      .forEach((u, i) => {
        out.set(u.edge, { ...out.get(u.edge), [u.role]: rows[i]! })
      })
  }
  return out
}

export interface Slot {
  run: PortRun
  role: 'S' | 'E'
  fixed: boolean
  /** The edge is one L: a run out of the port, then one run into the far side. */
  elbow: boolean
  /** How far the run travels from the port, in grid cells. */
  extent: number
  /** Which row the far end of an elbow takes at its own node (`pushOf`). */
  far: number
  /** Column of the vertical lane the run on a side face turns onto, if any. */
  lane?: number
  /** +1 when the edge's left-to-right pair runs downward, -1 upward. */
  down: number
}

/** The lane an `h` run turns onto: the column of the vertical run beside it. */
function laneOf(
  edge: AsciiEdge,
  run: PortRun,
  role: 'S' | 'E',
): number | undefined {
  if (run.axis !== 'h') return undefined
  const turn = role === 'S' ? run.to : run.from
  const last = edge.path.length - 1
  if (!(turn > 0 && turn < last)) return undefined
  // A return into a diamond is drawn a column left of the lane it shares.
  return edge.path[turn]!.x - (returnsToDiamond(edge) ? 0.5 : 0)
}

/** A Z back edge into a diamond's right face: out of the node, up, then in. */
function returnsToDiamond(edge: AsciiEdge): boolean {
  const p = edge.path
  return (
    edge.to.shape === 'diamond' &&
    p.length === 4 &&
    p[0]!.x > p[3]!.x &&
    p[0]!.y !== p[3]!.y
  )
}

/** Slope of an edge read left to right, so both edges of a pair agree. */
function downOf(edge: AsciiEdge): number {
  const a = edge.path[0]!
  const z = edge.path[edge.path.length - 1]!
  return Math.sign(z.y - a.y) * Math.sign(z.x - a.x)
}

/**
 * Two edges that meet at one side face from opposite ends (a decision and a
 * back edge to it), each turning onto its own vertical lane, cross unless their
 * rows follow their lanes: the edge whose lane is farther left takes the lower
 * rows at both nodes when the pair runs down, the upper rows when it runs up.
 * `pushOf` reads each end as an L, which sends the far end of a Z, or a Z
 * against an L, to the wrong row.
 */
export function nestedRow(
  slots: ReadonlyMap<string, Slot>,
  key: string,
  portOf: (key: string) => string,
): 1 | -1 | undefined {
  const me = slots.get(key)!
  if (me.lane === undefined) return undefined
  const other = [...slots].find(
    ([k, o]) =>
      k !== key &&
      portOf(k) === portOf(key) &&
      o.role !== me.role &&
      o.lane !== undefined &&
      o.lane !== me.lane,
  )?.[1]
  if (!other) return undefined
  return (me.lane < other.lane! ? me.down : -me.down) as 1 | -1
}

/** The row the far end of an L edge takes, from its own `pushOf`. */
export function farPush(edge: AsciiEdge, role: 'S' | 'E'): number {
  const far = role === 'S' ? endRun(edge) : startRun(edge)
  return far ? pushOf(far, role === 'S' ? 'E' : 'S') : 0
}

/**
 * Two bent edges that leave and enter one port face and bend the same way (a
 * reciprocal pair round a diamond vertex) cross unless they nest. The one that
 * bends nearer the node takes the column on the side they bend toward. Bends at
 * the same distance are ordered by the rows the far node gives them (`far`).
 * `pushOf` alone puts the down-travelling edge on the right whichever
 * way it bends, so a return bending right cut across it.
 */
export function nestedPush(
  slots: ReadonlyMap<string, Slot>,
  key: string,
  portOf: (key: string) => string,
): 1 | -1 | undefined {
  const me = slots.get(key)!
  if (!me.elbow || me.run.axis !== 'v' || me.run.turn === 0) return undefined
  const heading = (s: Slot): 1 | -1 =>
    (s.role === 'S' ? s.run.turn : -s.run.turn) as 1 | -1
  const other = [...slots].find(
    ([k, o]) =>
      k !== key &&
      portOf(k) === portOf(key) &&
      o.role !== me.role &&
      o.elbow &&
      o.run.axis === 'v' &&
      o.run.side === me.run.side &&
      o.run.turn !== 0 &&
      heading(o) === heading(me),
  )?.[1]
  if (!other) return undefined
  let nearer: boolean
  if (other.extent !== me.extent) nearer = me.extent < other.extent
  else if (other.far === me.far) return undefined
  else
    nearer = me.run.side === 'bottom' ? me.far < other.far : me.far > other.far
  return nearer ? heading(me) : (-heading(me) as 1 | -1)
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
/** Per-edge `pathToDrawing` results, valid for the same scope (#1458). */
const scopedPaths = new WeakMap<AsciiGraph, Map<AsciiEdge, DrawingCoord[]>>()

export function withPortShifts<T>(graph: AsciiGraph, run: () => T): T {
  if (scopedShifts.has(graph)) return run()
  scopedShifts.set(graph, computePortShifts(graph))
  scopedPaths.set(graph, new Map())
  try {
    return run()
  } finally {
    scopedShifts.delete(graph)
    scopedPaths.delete(graph)
  }
}

function computePortShifts(graph: AsciiGraph): Map<AsciiEdge, PortShift> {
  const result = new Map<AsciiEdge, PortShift>()
  if (graph.edges.length < 2) return result
  const shiftedRun = (run: PortRun): ShiftedRun => ({
    axis: run.axis,
    line: run.line,
    from: run.from,
    to: run.to,
  })

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
    edge: AsciiEdge,
  ): string => {
    const port = portKey(node, cell)
    const key = `${port}|${role}`
    if (!parent.has(key)) parent.set(key, key)
    slotEdges.set(key, (slotEdges.get(key) ?? 0) + 1)
    const existing = slots.get(key)
    if (!existing || (fixed && !existing.fixed)) {
      slots.set(key, {
        run,
        role,
        fixed,
        elbow: edge.path.length === 3,
        extent: runExtent(edge, run),
        far: farPush(edge, role),
        lane: laneOf(edge, run, role),
        down: downOf(edge),
      })
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
    // A flow-face back-edge takes the free cell beside the stems in allocateFaces
    // below; it must not push those stems off their ports.
    if (edge.faceLane) continue
    if (isFixed(edge)) {
      // A bundled, lane or cluster edge stays where it was routed, at both
      // ends; without a run of its own it still occupies its ports.
      const s = startRun(edge)
      const e = endRun(edge)
      if (s) addSlot(edge.from, edge.path[0]!, 'S', s, true, edge)
      if (e)
        addSlot(edge.to, edge.path[edge.path.length - 1]!, 'E', e, true, edge)
      const end = clusterLaneEndShift(graph, edge)
      if (end && e) {
        result.set(edge, { start: 0, end, endRun: shiftedRun(e) })
      }
      continue
    }
    const r = runsOf(edge)
    if (!r) continue
    const entry: { r: EdgeRuns; s?: string; e?: string } = { r }
    if (r.start) {
      entry.s = addSlot(r.start.node, r.start.cell, 'S', r.start, false, edge)
      const group = startGroups.get(entry.s) ?? []
      group.push({ edge, run: r.start, straight: r.straight })
      startGroups.set(entry.s, group)
    }
    if (r.end)
      entry.e = addSlot(r.end.node, r.end.cell, 'E', r.end, false, edge)
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

  const offsets = new Map<string, number>() // Component root -> offset
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
    const push =
      nestedPush(slots, keys[0]!, portOf) ??
      nestedRow(slots, keys[0]!, portOf) ??
      pushOf(members[0]!.run, members[0]!.role)
    // A port that also fans out keeps the narrow split: `staggerFanOuts`
    // spaces its stems from this offset (#1308).
    const fansOut = ports.some((port) =>
      [...slotEdges].some(([k, n]) => n > 1 && portOf(k) === port),
    )
    const magnitudes =
      nearFixed || fansOut
        ? nearFixed
          ? [STROKE_SPACING, 1]
          : [1]
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

  const slotOffset = (key: string): number => offsets.get(find(key)) ?? 0
  const staggered = new Map<AsciiEdge, number>()
  for (const [key, members] of startGroups) {
    if (members.length < 2 || slots.get(key)!.fixed) continue
    const port = portOf(key)
    const taken = [...slots.keys()]
      .filter((k) => k !== key && portOf(k) === port)
      .map(slotOffset)
    if (!spreadRightFan(graph, members, staggered, taken)) {
      staggerFanOuts(graph, members, slotOffset(key), taken, staggered)
    }
  }

  const diamond = spreadDiamondFaces(graph, runs)
  const split = splitLabeledArrivals(runs)
  const spread = spreadParallelEdges(runs, rolesAt, portOf)
  const landings = separateFanIns(
    graph,
    runs,
    slots,
    slotEdges,
    rolesAt,
    portOf,
    slotOffset,
  )

  for (const [edge, { r, s, e }] of runs) {
    // A duplicate out of a decision takes its own cell of the slant (and keeps
    // that row to a straight end) rather than the pair's spread.
    const slant = diamond.get(edge)?.start
    const own =
      slant !== undefined &&
      spread.has(edge) &&
      (r.straight || graph.config.graphDirection !== 'LR')
        ? slant
        : spread.get(edge)
    const lane = landings.get(edge)
    const start =
      own ??
      lane?.start ??
      diamond.get(edge)?.start ??
      staggered.get(edge) ??
      (s ? slotOffset(s) : 0)
    const end =
      own ??
      lane?.end ??
      diamond.get(edge)?.end ??
      split.get(edge) ??
      (e ? (offsets.get(find(e)) ?? 0) : 0)
    if (start === 0 && end === 0 && !lane?.points && !diamond.has(edge))
      continue
    const shift: PortShift = { start, end }
    if (lane?.points) shift.points = lane.points
    if (r.start) shift.startRun = shiftedRun(r.start)
    if (r.end) shift.endRun = shiftedRun(r.end)
    result.set(edge, shift)
  }
  raiseFlowFanBars(graph, runs, result)
  nudgeDiamondReturns(graph, result)
  // A flow-face lane is drawn from its plan, on its own port: nothing to place.
  for (const e of graph.edges) {
    if (flowLaneOf(e)) result.set(e, { start: 0, end: 0 })
  }
  allocateFaces(graph, result, shiftedRun)
  // A straight duplicate out of a decision keeps its own cell of the vertex to
  // the target, so the pair arrives side by side (#2918).
  if (graph.config.graphDirection !== 'LR') {
    for (const [e, d] of diamond) {
      const sh = result.get(e)
      if (sh && d.start !== undefined && runs.get(e)?.r.straight) {
        sh.start = d.start
        sh.end = d.start
      }
    }
  }
  spreadFaceLaneRuns(graph, result)
  nestDecisionDuplicates(graph, diamond, result)
  if (graph.edgeHints) planJogRows(graph, result)
  return result
}

/**
 * Duplicate branches of a decision that bend to one target nest like L shapes
 * instead of sharing a column (#2780): the branch higher on the slant enters
 * the target higher, and the one leaving nearer the target turns first.
 */
function nestDecisionDuplicates(
  graph: AsciiGraph,
  diamond: ReadonlyMap<AsciiEdge, { start?: number }>,
  result: Map<AsciiEdge, PortShift>,
): void {
  // Straight duplicates keep their slant row all the way to the target.
  for (const [e, d] of diamond) {
    const sh = result.get(e)
    if (
      d.start === undefined ||
      !sh ||
      e.path.length !== 2 ||
      !graph.edges.some((o) => o !== e && o.from === e.from && o.to === e.to)
    )
      continue
    sh.end = sh.start
  }
  const bent = [...diamond.keys()].filter(
    (e) =>
      e.path.length === 4 &&
      result.get(e)?.points &&
      diamond.get(e)?.start !== undefined,
  )
  for (const a of bent) {
    const b = bent.find((o) => o !== a && o.to === a.to && o.from === a.from)
    if (!b || graph.edges.indexOf(a) > graph.edges.indexOf(b)) continue
    const [hi, lo] = [a, b].sort(
      (x, y) => result.get(x)!.start - result.get(y)!.start,
    ) as [AsciiEdge, AsciiEdge]
    const sh = result.get(hi)!
    const sl = result.get(lo)!
    if (sh.end > sl.end) [sh.end, sl.end] = [sl.end, sh.end]
    const up = requireGridCoord(a.to).y < requireGridCoord(a.from).y
    const outer = up ? sl : sh
    // The outer turn needs a cell of stroke before the target's arrowhead.
    const turn = gridToDrawingCoord(graph, a.path[1]!).x + outer.points![1]!.x
    if (turn + 1 >= a.to.drawingCoord!.x - 1) continue
    for (const i of [1, 2]) outer.points![i]!.x += 1
  }
}

/**
 * A flow-face fan-out edge bends on the row two below its source's border,
 * not mid-gap: the drop into the target then has room for its label, the way
 * Mermaid draws the bend near the source and the label on the drop.
 */
function raiseFlowFanBars(
  graph: AsciiGraph,
  runs: ReadonlyMap<AsciiEdge, RunEntry>,
  result: Map<AsciiEdge, PortShift>,
): void {
  const lr = graph.config.graphDirection === 'LR'
  for (const [edge, { r }] of runs) {
    const p = edge.path
    if (
      r.straight ||
      p.length !== 4 ||
      !(lr ? leavesRightFace : leavesFlowFace)(
        graph,
        edge,
        graph.config.graphDirection,
      )
    ) {
      continue
    }
    // A routed node always has its drawing and coordinate.
    const from = edge.from.drawingCoord!
    const size = lr ? edge.from.drawing!.length : edge.from.drawing![0]!.length
    const at = gridToDrawingCoord(graph, p[1]!)
    const d = (lr ? from.x : from.y) + size + 1 - (lr ? at.x : at.y)
    /* v8 ignore next */
    if (d >= 0) continue
    const shift = result.get(edge) ?? { start: 0, end: 0 }
    const points = shift.points ?? p.map(() => ({ x: 0, y: 0 }))
    for (const i of [1, 2]) points[i]![lr ? 'x' : 'y'] = d
    result.set(edge, { ...shift, points })
  }
}

/** One Z-shaped edge (out along the flow, across on its bend row, on along the flow) in a gap. */
export interface Jog {
  edge: AsciiEdge
  /** Index in the edge's path of the Z's first point. */
  at: number
  /** Drawn bend row (column for LR) before planning. */
  row: number
  /** Drawn cross-axis position of the leg nearer the gap's first side, and of the other. */
  near: number
  far: number
  /** Bend row of the grid path, before any shift. */
  base: number
}

const spanOf = (j: Jog): [number, number] => [
  Math.min(j.near, j.far),
  Math.max(j.near, j.far),
]

const MAX_GAP_JOGS = 12
const sharesTrunk = (a: Jog, b: Jog): boolean =>
  a.near === b.near || a.far === b.far

/**
 * The cost of putting each jog of one gap on a row of its own (#2888): two
 * strokes on one row that overlap, or touch, merge into a shared run; a stroke
 * whose leg runs through another's bend row crosses it (`┼`).
 */
function jogCost(jogs: Jog[], rows: number[], lo: number): number {
  let cost = 0
  for (let i = 0; i < jogs.length; i++) {
    cost += (rows[i]! - lo) * 0.01
    const [a0, a1] = spanOf(jogs[i]!)
    for (let j = i + 1; j < jogs.length; j++) {
      const [b0, b1] = spanOf(jogs[j]!)
      // Strokes out of one cell, or into one, are a trunk: they stay on one row.
      if (sharesTrunk(jogs[i]!, jogs[j]!)) {
        if (rows[i] !== rows[j]) cost += 5
        continue
      }
      if (a0 <= b1 && b0 <= a1) {
        if (rows[i] === rows[j]) cost += 100
        else if (Math.abs(rows[i]! - rows[j]!) === 1) cost += 1
      }
      for (const [x, y] of [
        [i, j],
        [j, i],
      ] as const) {
        const [s0, s1] = spanOf(jogs[x]!)
        const o = jogs[y]!
        // The other's near leg runs from the gap's first side to its bend row,
        // its far leg from there to the gap's end.
        if (rows[x]! < rows[y]! && o.near > s0 && o.near < s1) cost += 10
        if (rows[x]! > rows[y]! && o.far > s0 && o.far < s1) cost += 10
      }
    }
  }
  return cost
}

/** The rows `lo..hi` that cost least for these jogs: exhaustive for the few a gap holds, else coordinate descent. */
export function bestJogRows(jogs: Jog[], lo: number, hi: number): number[] {
  const n = jogs.length
  const count = hi - lo + 1
  let best = jogs.map(() => lo)
  let bestCost = Infinity
  if (count ** n <= 20000) {
    const rows = jogs.map(() => lo)
    for (let k = 0; k < count ** n; k++) {
      let rest = k
      for (let i = 0; i < n; i++) {
        rows[i] = lo + (rest % count)
        rest = Math.floor(rest / count)
      }
      const c = jogCost(jogs, rows, lo)
      if (c < bestCost) {
        bestCost = c
        best = [...rows]
      }
    }
    return best
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < n; i++) {
      for (let r = lo; r <= hi; r++) {
        const trial = [...best]
        trial[i] = r
        const c = jogCost(jogs, trial, lo)
        if (c < bestCost) {
          bestCost = c
          best = trial
        }
      }
    }
  }
  return best
}

/**
 * Give each Z-shaped edge of a gap its own bend row when strokes that share
 * one would merge (#2888), as ELK keeps one jog per edge: the legs of a
 * stroke that runs through another's bend row cross, so the rows are chosen
 * to cross least, outermost strokes nearest the node they leave.
 */
function planJogRows(
  graph: AsciiGraph,
  result: Map<AsciiEdge, PortShift>,
): void {
  const lr = graph.config.graphDirection === 'LR'
  const main = lr ? 'x' : 'y'
  const cross = lr ? 'y' : 'x'
  const gaps = new Map<number, Jog[]>()
  for (const edge of graph.edges) {
    // A lane ELK routes between faces (#2902) ends in a Z too: its last four points.
    const at = edge.hintedLane && edge.path.length === 6 ? 2 : 0
    const p = edge.path.slice(at)
    if (
      p.length !== 4 ||
      p[0]![cross] !== p[1]![cross] ||
      p[1]![main] !== p[2]![main] ||
      p[2]![cross] !== p[3]![cross] ||
      p[1]![cross] === p[2]![cross] ||
      edge.bundle ||
      edge.faceLane ||
      edge.from === edge.to ||
      flowLaneOf(edge)
    ) {
      continue
    }
    const shift = result.get(edge)
    const d = drawnPath(graph, edge, shift).slice(at)
    // Near leg: the one on the side of the gap its grid row lies after.
    const forward = p[0]![main] < p[3]![main]
    const [n, f] = forward ? [d[0]!, d[3]!] : [d[3]!, d[0]!]
    const jog: Jog = {
      edge,
      at,
      row: d[1]![main],
      near: n[cross],
      far: f[cross],
      base: lineToDrawing(graph, p)[1]![main],
    }
    const g = p[1]![main]
    gaps.set(g, [...(gaps.get(g) ?? []), jog])
  }
  for (const [g, jogs] of gaps) {
    // A gap with more jogs than this keeps its shared rows: the search is cubic in them.
    if (jogs.length < 2 || jogs.length > MAX_GAP_JOGS) continue
    const size = (lr ? graph.columnWidth : graph.rowHeight).get(g) ?? 0
    const first =
      lineToDrawing(graph, [{ x: g, y: g }])[0]![main] - Math.floor(size / 2)
    const lo = first + 1
    const hi = first + size - 2
    const shared = jogs.some((a, i) =>
      jogs.some((b, j) => {
        const [a0, a1] = spanOf(a)
        const [b0, b1] = spanOf(b)
        return (
          i < j && !sharesTrunk(a, b) && a.row === b.row && a0 <= b1 && b0 <= a1
        )
      }),
    )
    if (!shared) continue
    // Rows for every jog to have its own, with a clear row between and room
    // for a label and the arrowhead: what the gap is widened to (also when it
    // has no usable row yet).
    const own = bestJogRows(jogs, lo, lo + Math.max(hi - lo, jogs.length - 1))
    const need = 2 * new Set(own).size + 3
    const best = hi < lo ? undefined : bestJogRows(jogs, lo, hi)
    jogs.forEach((jog, i) => {
      const shift = result.get(jog.edge) ?? { start: 0, end: 0 }
      const points = shift.points ?? jog.edge.path.map(() => ({ x: 0, y: 0 }))
      if (best)
        for (const k of [1, 2]) points[jog.at + k]![main] = best[i]! - jog.base
      result.set(jog.edge, {
        ...shift,
        points,
        jogGap: { line: g, size: need },
      })
    })
  }
}

/**
 * Draw a return into a diamond's right face (#2645) one column inside the
 * gutter lane it shares with the decision's own branch, and its ends on the
 * slant: the arrow meets the face as Mermaid's does, with no gap.
 */
function nudgeDiamondReturns(
  graph: AsciiGraph,
  result: Map<AsciiEdge, PortShift>,
): void {
  if (graph.config.graphDirection !== 'LR') return
  for (const edge of graph.edges) {
    if (!returnsToDiamond(edge)) continue
    const shift = result.get(edge) ?? { start: 0, end: 0 }
    const points = shift.points ?? edge.path.map(() => ({ x: 0, y: 0 }))
    points[1]!.x -= 1
    points[2]!.x -= 1
    points[3]!.x -= 2
    result.set(edge, { ...shift, points })
  }
}

/**
 * Draw the departure and arrival runs of flow-axis face lanes on the rows the
 * plan gave them (#2121), so lanes sharing a gutter row do not run along one
 * another. Path points 1-2 are the departure run, 3-4 the arrival run.
 */
function spreadFaceLaneRuns(
  graph: AsciiGraph,
  result: Map<AsciiEdge, PortShift>,
): void {
  const vertical = graph.config.graphDirection !== 'LR'
  for (const e of graph.edges) {
    const plan = e.faceLanePlan
    if (!plan || !e.faceLane || e.path.length !== 6) continue
    const shift = result.get(e) ?? { start: 0, end: 0 }
    const at = (by: number): DrawingCoord =>
      vertical ? { x: 0, y: by } : { x: by, y: 0 }
    const zero = at(0)
    shift.points = [
      zero,
      at(plan.dep),
      at(plan.dep),
      at(plan.arr),
      at(plan.arr),
      zero,
    ]
    result.set(e, shift)
  }
}

/** One end of a lane edge or self-loop on a node face, for `allocateFaces`. */
interface FaceEnd {
  edge: AsciiEdge
  run: PortRun
  role: 'S' | 'E'
  /** Place in ELK's order along the face (smaller first), one cell of its own (#2645). */
  rank?: number
}

const endsOf = (e: AsciiEdge): [PortRun | undefined, 'S' | 'E'][] => [
  [startRun(e), 'S'],
  [endRun(e), 'E'],
]

const SIDE_FACE = { top: 'T', bottom: 'B', left: 'L', right: 'R' } as const

/**
 * Both edges of a labelled reciprocal pair that bend (not straight strokes) run
 * along one bend row, so their labels land on the same run and print over each
 * other; a vertical flow gives each edge a jog row of its own (`planJogRows`,
 * #2888), a horizontal one does not yet, so there such a pair keeps the grid's
 * placement.
 */
function labelledBentPair(graph: AsciiGraph, edge: AsciiEdge): boolean {
  const other = graph.edges.find(
    (o) => o !== edge && o.from === edge.to && o.to === edge.from,
  )
  return (
    other !== undefined &&
    edge.text !== '' &&
    other.text !== '' &&
    !runsOf(edge)?.straight &&
    !runsOf(other)?.straight
  )
}

/**
 * The faces whose every end is a plain edge with an ELK hint for that very
 * face, as ends ranked by ELK's order along it (#2645). Within a reciprocal
 * pair ELK gives both ends one position: the forward end goes first. A face
 * with any other end (a loop, a bundle, a cluster edge, an end the hint puts
 * elsewhere) keeps the grid's own placement.
 */
function hintedFaces(graph: AsciiGraph): Map<string, FaceEnd[]> {
  const hints = graph.edgeHints
  const out = new Map<string, FaceEnd[]>()
  if (!hints) return out
  const all = new Map<string, FaceEnd[]>()
  for (const edge of graph.edges) {
    /* v8 ignore next */
    if (edge.path.length < 2) continue
    for (const [run, role] of endsOf(edge)) {
      /* v8 ignore next */
      if (!run) continue
      const k = `${run.node.index}|${run.side}`
      all.set(k, [...(all.get(k) ?? []), { edge, run, role }])
    }
  }
  const dir = graph.parsed?.direction
  const horizontal = graph.config.graphDirection === 'LR'
  for (const [k, list] of all) {
    const ranked = list.map((f) => {
      const h = hints.get(f.edge)
      const e = f.role === 'S' ? h?.start : h?.end
      const plain =
        f.edge.from !== f.edge.to &&
        f.edge.bundle === undefined &&
        !f.edge.clusterSource &&
        !f.edge.clusterTarget &&
        f.edge.style !== 'invisible'
      if (!e || !plain || e.face !== SIDE_FACE[f.run.side]) return undefined
      // RL and BT are flipped after drawing: the order along the face flips too.
      const flip = f.run.axis === 'v' ? dir === 'RL' : dir === 'BT'
      const [a, b] = [
        requireGridCoord(f.edge.from),
        requireGridCoord(f.edge.to),
      ]
      const back = horizontal ? a.x > b.x : a.y > b.y
      const rank = e.order * 4 + (back ? 1 : 0)
      /* v8 ignore next */
      return { ...f, rank: flip ? -rank : rank }
    })
    if (list.length < 2 || ranked.some((r) => r === undefined)) continue
    if (horizontal && list.some((f) => labelledBentPair(graph, f.edge)))
      continue
    out.set(k, ranked as FaceEnd[])
  }
  return out
}

/**
 * The one record of which cells of each node face are taken (#2025, #2028,
 * #2030). Lane edges and self-loops keep their routed geometry, so each of
 * their ends starts at the port centre, on top of whatever else uses the face.
 * Every other edge's end is placed by now and holds its cell; the lane and loop
 * ends of a face then get cells of their own (`placeFace`). Ends of one route
 * (duplicate self-loops, #2028) share a cell. Every edge keeps its own lane
 * (#2072, as Mermaid draws one path per edge); when a face is too short, ends
 * of one role may share a cell (a fan), and failing that the face's ends stay
 * at the centre. Last, a self-loop that runs along another
 * edge is drawn a cell closer to its node (`hugLoop`).
 */
function allocateFaces(
  graph: AsciiGraph,
  result: Map<AsciiEdge, PortShift>,
  shiftedRun: (run: PortRun) => ShiftedRun,
): void {
  const lanes = graph.edges.filter(
    (e) =>
      e.path.length >= 2 &&
      !result.has(e) &&
      (e.from === e.to ||
        e.faceLane === true ||
        e.ownPorts === true ||
        (e.parallelLane !== undefined &&
          !e.bundle &&
          !e.clusterSource &&
          !e.clusterTarget &&
          // A spike lane (#329) folds back on its stem: keep it there.
          new Set(e.path.map((p) => `${p.x},${p.y}`)).size === e.path.length)),
  )
  const faceOf = (run: PortRun): string => `${run.node.index}|${run.side}`
  // #2645: faces ELK orders are placed first, in its order, one cell per end.
  const ranked = hintedFaces(graph)
  const taken = new Set<string>()
  const fixed = new Map<AsciiEdge, number>()
  // #2913: a decision with four or more ends on its flow face gives each its
  // own slant row, ordered by where its other end lies, so no two share a stem
  // and none crosses another (as mermaid spreads the ports).
  if (graph.edgeHints && graph.config.graphDirection === 'LR') {
    const byFace = new Map<string, (FaceEnd & { y: number })[]>()
    for (const edge of graph.edges) {
      if (edge.from === edge.to || edge.path.length < 2) continue
      for (const [run, role] of endsOf(edge)) {
        if (!run || run.node.shape !== 'diamond' || run.side !== 'right')
          continue
        const other = role === 'S' ? edge.to : edge.from
        const k = faceOf(run)
        byFace.set(k, [
          ...(byFace.get(k) ?? []),
          { edge, run, role, y: requireGridCoord(other).y },
        ])
      }
    }
    for (const [face, ends] of byFace) {
      const geo = portGeometry(graph, ends[0]!.run)
      const n = ends.length
      if (n < 4 || !geo) continue
      ends.sort(
        (a, b) =>
          a.y - b.y ||
          (a.role === b.role ? 0 : a.role === 'S' ? -1 : 1) ||
          graph.edges.indexOf(a.edge) - graph.edges.indexOf(b.edge),
      )
      // Adjacent slant rows, the vertex row too when the count is odd.
      const offs = ends.map((_, i) =>
        n % 2 ? i - (n - 1) / 2 : i - n / 2 + (i < n / 2 ? 0 : 1),
      )
      if (
        !offs.every(
          (o) =>
            o === 0 ||
            attachesAt(ends[0]!.run, geo.centre + o, geo, true, true),
        )
      )
        continue
      ends.forEach((f, i) => {
        f.rank = i
        if (!runsOf(f.edge)?.straight) return
        fixed.set(f.edge, offs[i]!)
        // The stroke's far end follows on its own face, which then keeps these
        // rows whatever order ELK ranked it in.
        const [run, role] = endsOf(f.edge).find(([r, w]) => r && w !== f.role)!
        if (!run) return
        applyOffsets(
          result,
          [{ edge: f.edge, run, role }],
          [offs[i]!],
          shiftedRun,
        )
        ranked.delete(faceOf(run))
      })
      applyOffsets(result, ends, offs, shiftedRun)
      ranked.delete(face)
      taken.add(face)
    }
  }
  // The fullest face first: it needs the closest spacing, and a straight edge
  // then carries its cell over to the other face (a face of two would spread
  // its pair a stroke spacing apart and leave no cell for a third end beside).
  const byFill = [...ranked].sort((a, b) => b[1].length - a[1].length)
  for (const [face, list] of byFill) {
    const offs = placeFace(graph, list, [], fixed, false)
    if (!offs) continue
    list.forEach((f, i) => {
      if (!runsOf(f.edge)?.straight) return
      fixed.set(f.edge, offs[i]!)
      // A straight edge is one stroke: its other end moves with this one, unless
      // that face is ordered too, where `fixed` holds it to this cell.
      const [run, role] = endsOf(f.edge).find(([r, w]) => r && w !== f.role)!
      if (run && !ranked.has(faceOf(run)))
        applyOffsets(
          result,
          [{ edge: f.edge, run, role }],
          [offs[i]!],
          shiftedRun,
        )
    })
    applyOffsets(result, list, offs, shiftedRun)
    taken.add(face)
  }
  const held = new Map<string, Held[]>()
  for (const e of graph.edges) {
    if (e.path.length < 2 || lanes.includes(e)) continue
    const shift = result.get(e)
    for (const [run, role] of endsOf(e)) {
      const geo = run && portGeometry(graph, run)
      if (!run || !geo) continue
      const by = (role === 'S' ? shift?.start : shift?.end) ?? 0
      const k = faceOf(run)
      held.set(k, [
        ...(held.get(k) ?? []),
        { ...shapeOf({ edge: e, run, role }), at: geo.centre + by },
      ])
    }
  }
  const faces = new Map<string, FaceEnd[]>()
  // Loops first: a face a loop shares with a straight lane is placed with the
  // loop in view, so the lane's other end follows it, not the reverse (#2100).
  const byLoop = [...lanes].sort(
    (a, b) => Number(b.from === b.to) - Number(a.from === a.to),
  )
  for (const edge of byLoop) {
    for (const [run, role] of endsOf(edge)) {
      if (!run || taken.has(faceOf(run))) continue
      faces.set(faceOf(run), [
        ...(faces.get(faceOf(run)) ?? []),
        { edge, run, role },
      ])
    }
  }
  const placed = new Map<FaceEnd, number>()
  // A straight lane is one run: the face placed first fixes it for both.
  for (const [face, list] of faces) {
    const has = held.get(face) ?? []
    const offs =
      placeFace(graph, list, has, fixed, false) ??
      placeFace(graph, list, has, fixed, true) ??
      list.map(() => 0)
    list.forEach((f, i) => {
      placed.set(f, offs[i]!)
      if (runsOf(f.edge)?.straight) fixed.set(f.edge, offs[i]!)
    })
  }
  // #2645: a dense pair's loop is a hook centred over the top face, as
  // Mermaid draws it (its cells were placed about the grid cell's corner).
  const slantStops = new Map<FaceEnd, number>()
  for (const [f, by0] of placed) {
    const geo = portGeometry(graph, f.run)
    const hint = graph.edgeHints?.get(f.edge)
    if (geo && hint && (isDenseHook(f.edge) || isLeftHook(f.edge))) {
      // ELK's loop: out of the cell its order puts first, back into the other,
      // as close to the centre as the face allows (a 5-wide box has three cells).
      const left = loopStartsLow(graph, f.edge) ? -1 : 1
      const k = Math.min(2, Math.floor((geo.hi - geo.lo) / 2))
      const dc = f.run.node.drawingCoord
      if (f.run.node.shape === 'diamond' && dc) {
        // A diamond's hook flanks its vertex, on the two slants beside it (a
        // face of one or two cells has no room for a hook's legs).
        const [lo, hi] = slantGlyphs(f.run)
        const at = (f.role === 'S') === left < 0 ? lo : hi
        placed.set(f, (f.run.axis === 'h' ? dc.y : dc.x) + at - geo.centre)
        slantStops.set(f, slantBlanks(f.run, at))
        continue
      }
      placed.set(
        f,
        Math.round((geo.lo + geo.hi) / 2 - geo.centre) +
          (f.role === 'S' ? left : -left) * k,
      )
    } else if (geo && isDenseHook(f.edge)) {
      placed.set(
        f,
        by0 +
          Math.round((geo.lo + geo.hi) / 2 - geo.centre) +
          (f.role === 'S' ? 2 : -2),
      )
    }
  }
  applyOffsets(
    result,
    [...placed.keys()],
    [...placed.values()],
    shiftedRun,
    true,
  )
  // A diamond hook's start sits on its slant glyph, its arrowhead on the blank
  // cell before it.
  // Hooks are on the top or left face (RL and BT are flipped after drawing), so
  // the glyph is always `blanks` cells in from the low edge.
  for (const [f, blanks] of slantStops) {
    const shift = result.get(f.edge)!
    shift.points ??= f.edge.path.map(() => ({ x: 0, y: 0 }))
    const p = shift.points[f.role === 'S' ? 0 : f.edge.path.length - 1]!
    if (f.run.axis === 'h') p.x += blanks
    else p.y += blanks
  }
  for (const loop of lanes) {
    if (loop.from === loop.to) hugLoop(graph, loop, result)
  }
}

/**
 * The two slant glyphs beside a diamond's vertex on a face, as positions along
 * it: the slant glyphs on the first line in from the face's border that has any.
 */
function slantGlyphs(run: PortRun): [number, number] {
  const d = run.node.drawing!
  const h = run.axis === 'h'
  const len = h ? d.length : d[0]!.length
  for (let i = 0; i < len; i++) {
    const at = (h ? d[i]! : d.map((c) => c[i]!)).flatMap((c, k) =>
      c === '╱' || c === '╲' || c === '/' || c === '\\' ? [k] : [],
    )
    if (at.length) return [at[0]!, at[at.length - 1]!]
  }
  /* v8 ignore next */
  return [0, 0]
}

/** Blank cells from a diamond's border in to its slant glyph, on the row (column) `at` of its drawing. */
function slantBlanks(run: PortRun, at: number): number {
  const d = run.node.drawing!
  const h = run.axis === 'h'
  let n = 0
  while ((h ? d[n]?.[at] : d[at]?.[n]) === ' ') n++
  return n
}

/** Cells from a diamond's side border in to the slant glyph on the row `by` off the centre. */
function slantDepth(run: PortRun, by: number): number {
  const drawing = run.node.drawing!
  const centreRow = Math.floor(drawing[0]!.length / 2)
  const step = run.side === 'left' ? 1 : -1
  let x = run.side === 'left' ? 0 : drawing.length - 1
  let n = 0
  while (drawing[x] && drawing[x]![centreRow + by] === ' ') {
    x += step
    n++
  }
  return n
}

/** Writes the placed offsets into the shifts; a zero keeps the routed one unless `skipZero` is false. */
function applyOffsets(
  result: Map<AsciiEdge, PortShift>,
  list: readonly FaceEnd[],
  offs: readonly number[],
  shiftedRun: (run: PortRun) => ShiftedRun,
  skipZero = false,
): void {
  list.forEach((f, i) => {
    const by = offs[i]!
    if (by === 0 && skipZero) return
    const shift = result.get(f.edge) ?? { start: 0, end: 0 }
    if (f.role === 'S') {
      shift.start = by
      shift.startRun = shiftedRun(f.run)
    } else {
      shift.end = by
      shift.endRun = shiftedRun(f.run)
    }
    // A stroke on a diamond's side slant starts on the slant, two cells inside
    // the border, not a gap away from it.
    if (f.rank !== undefined && by !== 0 && f.run.node.shape === 'diamond') {
      const d = slantDepth(f.run, by)
      if (f.run.axis === 'h' && d > 0) {
        shift.points ??= f.edge.path.map(() => ({ x: 0, y: 0 }))
        const at = f.role === 'S' ? 0 : f.edge.path.length - 1
        shift.points[at]!.x += f.run.side === 'right' ? -d : d
      }
    }
    result.set(f.edge, shift)
  })
}

/** A self-loop `determinePath` drew as a hook over the top face (#2645). */
function isDenseHook(e: AsciiEdge): boolean {
  return (
    e.from === e.to &&
    e.path.length === 4 &&
    dirEquals(e.startDir, Up) &&
    dirEquals(e.endDir, Up)
  )
}

/** A TD self-loop `determinePath` drew as a hook out of the left face (#2888). */
function isLeftHook(e: AsciiEdge): boolean {
  return (
    e.from === e.to &&
    e.path.length === 4 &&
    dirEquals(e.startDir, Left) &&
    dirEquals(e.endDir, Left)
  )
}

/** How an end leaves its face: which way it turns and how far out. */
function shapeOf(f: FaceEnd) {
  return {
    role: f.role,
    heading: f.role === 'S' ? f.run.turn : -f.run.turn,
    // A loop hugs its node: inside any lane it shares the face with.
    // Flow-axis face lanes: the outer lane's port sits farther out.
    depth: f.edge.faceLanePlan
      ? -f.edge.faceLanePlan.slot
      : runExtent(f.edge, f.run) - (f.edge.from === f.edge.to ? 0.5 : 0),
  }
}

/** A cell another edge's end holds on a face. */
type Held = ReturnType<typeof shapeOf> & { at: number }

/**
 * Cells for the lane and loop ends on one face, as offsets from each end's
 * port centre, or undefined when the face is too short. Ends heading one way
 * along the face sit on that side, the deeper (outer) lane farther from where
 * it goes, so the lanes nest instead of crossing or sharing a stem with a lane
 * that parts from it (a closed box). Cells are a stroke spacing apart, and
 * from the cells other edges hold, where the face is wide enough, else one
 * cell; with `share`, ends of one role may also share a cell. Among those the
 * cells nearest the centre win, on each end's own side, clear of other edges'
 * stems the end would run across.
 */
function placeFace(
  graph: AsciiGraph,
  list: FaceEnd[],
  held: Held[],
  fixed: ReadonlyMap<AsciiEdge, number>,
  share: boolean,
): number[] | undefined {
  const run = list[0]!.run
  const geo = portGeometry(graph, run)
  if (!geo) return undefined
  // ELK's own ends may sit on a diamond's slants (`spreadDiamondFaces`).
  const ranked = list.every((f) => f.rank !== undefined)
  const centre = geo.centre
  const info = list.map((f) => {
    const shape = shapeOf(f)
    return {
      ...shape,
      // Ends that turn the same way at the same depth run on together
      // beyond the stem: they are one route (a fan, or duplicate loops).
      // A dense facing pair (#2645) gives every edge a row of its own.
      key:
        f.rank === undefined
          ? `${shape.role}|${shape.heading}|${shape.depth}|${fixed.get(f.edge)}|${denseFacingPair(graph, f.edge) ? graph.edges.indexOf(f.edge) : ''}`
          : `${graph.edges.indexOf(f.edge)}|${f.role}`,
      rank: f.rank,
      // A straight lane: the #1284 pair side (down-travelling right).
      push: pushOf(f.run, f.role),
      // A flow-axis face lane stays on its outer side of every stem.
      lane: f.edge.faceLanePlan !== undefined,
      at: fixed.get(f.edge),
    }
  })
  type Route = (typeof info)[number]
  const routes = [...new Map(info.map((m) => [m.key, m])).values()]
  routes.sort(
    (a, b) =>
      // ELK's order among ends that head the same way. Ends heading apart keep
      // the grid's nesting (up before straight before down): the other order
      // would cross them.
      (a.rank !== undefined && b.rank !== undefined && a.heading === b.heading
        ? a.rank - b.rank
        : a.heading - b.heading) ||
      (a.heading < 0
        ? a.depth - b.depth
        : a.heading > 0
          ? b.depth - a.depth
          : a.push - b.push),
  )
  const cells: number[] = []
  for (let p = geo.lo; p <= geo.hi; p++) {
    // A diamond's side face has its vertex and the two slants beside it.
    const diamond = run.node.shape === 'diamond' && run.axis === 'h'
    if (ranked && diamond) {
      if (Math.abs(p - centre) > 1) continue
    }
    if (attachesAt(run, p, geo, ranked)) cells.push(p)
  }
  for (const gap of share ? [0] : [STROKE_SPACING, 1]) {
    // A cell `r` may take: off other edges' cells (one of its role, if
    // sharing), how far from the centre, and the stems it would run across.
    const cost = (r: Route, p: number): number => {
      if (r.at !== undefined && p !== centre + r.at) return Infinity
      // Running on with another edge's end: share its stem (a fan).
      const join = held.find(
        (h) =>
          h.role === r.role && h.heading === r.heading && h.depth === r.depth,
      )
      if (join) return p === join.at ? 0 : Infinity
      let c =
        2 * Math.abs(p - centre) -
        (Math.sign(p - centre) === (r.heading || r.push) ? 1 : 0)
      for (const h of held) {
        if (h.at === p && (gap > 0 || h.role !== r.role)) return Infinity
        if (Math.abs(h.at - p) < gap) return Infinity
        if (h.at === p) c += 4
        else if (Math.sign(h.at - p) === r.heading) {
          if (r.lane) return Infinity
          c += 3
        }
      }
      return c
    }
    // One entry per cell: the cheapest placing so far whose last route is there.
    let best = cells.map((p) => ({
      cost: cost(routes[0]!, p),
      at: [p],
      role: routes[0]!.role,
    }))
    for (const r of routes.slice(1)) {
      best = cells.map((p) => {
        const step = (b: (typeof best)[number]): number => {
          const d = p - b.at[b.at.length - 1]!
          return d >= Math.max(gap, 1)
            ? 0
            : d === 0 && gap === 0 && b.role === r.role
              ? 4
              : Infinity
        }
        const prev = best
          .map((b) => ({ b, c: b.cost + step(b) }))
          .sort((x, y) => x.c - y.c)[0]!
        return {
          cost: prev.c + cost(r, p),
          at: [...prev.b.at, p],
          role: r.role,
        }
      })
    }
    const win = best.sort((a, b) => a.cost - b.cost)[0]
    if (!win || win.cost === Infinity) continue
    const pos = new Map(routes.map((r, i) => [r.key, win.at[i]!]))
    return info.map((m) => pos.get(m.key)! - centre)
  }
  return undefined
}

/**
 * Draw a self-loop a cell closer to its node when its far legs run along
 * another edge's stroke, so it does not read as a branch of that edge
 * (#2025). Kept as routed when that would put a leg against the node, or
 * still run along something.
 */
function hugLoop(
  graph: AsciiGraph,
  loop: AsciiEdge,
  result: Map<AsciiEdge, PortShift>,
): void {
  const node = loop.from
  const dc = node.drawingCoord
  const drawing = node.drawing
  if (!dc || !drawing || loop.path.length < 4) return
  const box = {
    x0: dc.x,
    x1: dc.x + drawing.length - 1,
    y0: dc.y,
    y1: dc.y + (drawing[0]?.length ?? 0) - 1,
  }
  const others = graph.edges
    .filter((e) => e.from !== e.to && e.path.length >= 2)
    .flatMap((e) => segmentsOf(drawnPath(graph, e, result.get(e))))
  const shift = result.get(loop) ?? { start: 0, end: 0 }
  const along = (s: PortShift): boolean =>
    segmentsOf(drawnPath(graph, loop, s).slice(1, -1)).some(([a, b]) =>
      runsAlong(a, b, others),
    )
  if (!along(shift)) return
  const drawn = drawnPath(graph, loop, shift)
  const pull = (v: number, lo: number, hi: number): number =>
    v > hi ? -1 : v < lo ? 1 : 0
  const points = drawn.map((p, i) =>
    i === 0 || i === drawn.length - 1
      ? { x: 0, y: 0 }
      : { x: pull(p.x, box.x0, box.x1), y: pull(p.y, box.y0, box.y1) },
  )
  const hugged: PortShift = { ...shift, points }
  // The arrowhead needs a cell of its own before the last corner.
  const d = drawnPath(graph, loop, hugged)
  const [y, z] = d.slice(-2) as [DrawingCoord, DrawingCoord]
  const tight = Math.abs(y.x - z.x) + Math.abs(y.y - z.y) < 2
  if (tight || along(hugged)) return
  result.set(loop, hugged)
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
  slotOffset: (key: string) => number,
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
    if (group.length < 2) continue
    if ([...slots].some(([k, m]) => m.fixed && portOf(k) === port)) continue
    if (new Set(group.map((g) => g.from)).size < 2) continue
    // A port that also sends an edge up (#2100): the cells those ends hold
    // stay where `offsets` put them, and the fan-in lands beyond them.
    const held =
      rolesAt.get(port)!.size > 1
        ? [...slots.keys()].filter((k) => portOf(k) === port).map(slotOffset)
        : undefined
    const crowded = held && { held, own: slotOffset(key) }
    landFanIn(graph, runs, slotEdges, rolesAt, portOf, group, out, crowded)
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
  crowded?: { held: number[]; own: number },
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
  if (crowded) {
    // The port's other ends keep their cells (and a straight edge its tied
    // one); each bent edge takes the next cell beyond them on its own side.
    const { held, own } = crowded
    spacings.length = 0
    spacings.push(
      order.map((m) => {
        if (!m.bent) return own
        const rank = order.filter(
          (o) => o.bent && o.from === m.from && o.dist <= m.dist,
        ).length
        return m.from > 0
          ? Math.max(...held) + STROKE_SPACING * rank
          : Math.min(...held) - STROKE_SPACING * rank
      }),
    )
  }
  const offs =
    geo &&
    spacings.find((os) =>
      order.every(
        (m, i) =>
          Number.isInteger(os[i]) &&
          attachesAt(m.end, geo.centre + os[i]!, geo) &&
          (m.bent || os[i] === 0 || crowded || startOk(m, os[i]!)),
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
    if (!r.straight || !s || !e) continue
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
  return shift && pointShifts(edge, shift)
}

function pointShifts(edge: AsciiEdge, shift: PortShift): DrawingCoord[] {
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

/** Identity of the current `withPortShifts` scope's caches, or undefined outside one (#1490). */
export function pathScope(graph: AsciiGraph): object | undefined {
  return scopedPaths.get(graph)
}

/** `edge`'s whole path in drawing space, following any port shift. */
export function pathToDrawing(
  graph: AsciiGraph,
  edge: AsciiEdge,
): DrawingCoord[] {
  const cache = scopedPaths.get(graph)
  const hit = cache?.get(edge)
  if (hit) return hit
  const out = drawnPath(graph, edge, portShifts(graph).get(edge))
  cache?.set(edge, out)
  return out
}

function drawnPath(
  graph: AsciiGraph,
  edge: AsciiEdge,
  shift: PortShift | undefined,
): DrawingCoord[] {
  const lane = flowLanePolyline(graph, edge)
  if (lane) return lane
  const base = lineToDrawing(graph, edge.path)
  if (!shift) return base
  const shifts = pointShifts(edge, shift)
  return base.map((dc, i) => ({
    x: dc.x + shifts[i]!.x,
    y: dc.y + shifts[i]!.y,
  }))
}

/** The gap rows (columns for LR) whose size the jog rows of #2888 need widened, by grid line. */
export function jogGapSizes(graph: AsciiGraph): Map<number, number> {
  const out = new Map<number, number>()
  for (const shift of portShifts(graph).values()) {
    if (shift.jogGap) {
      out.set(
        shift.jogGap.line,
        Math.max(out.get(shift.jogGap.line) ?? 0, shift.jogGap.size),
      )
    }
  }
  return out
}
