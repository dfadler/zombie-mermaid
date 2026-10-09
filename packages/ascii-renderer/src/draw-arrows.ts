// ============================================================================
// ASCII renderer — arrow drawing (path, corners, arrowheads, box-start
// junctions, labels)
//
// Split out of draw.ts.
// ============================================================================

import {
  edgePointShifts,
  labelLineToDrawing,
  pathToDrawing,
  portShifts,
} from './port-offsets.ts'
import type {
  Canvas,
  DrawingCoord,
  GridCoord,
  Direction,
  AsciiGraph,
  AsciiEdge,
  AsciiEdgeStyle,
  AsciiNode,
  AsciiSubgraph,
} from './types.ts'
import {
  Up,
  Down,
  Left,
  Right,
  UpperLeft,
  UpperRight,
  LowerLeft,
  LowerRight,
  Middle,
  drawingCoordEquals,
  requireGridCoord,
} from './types.ts'
import { copyCanvas, drawText, write } from './canvas.ts'
import { determineDirection, dirEquals } from './edge-routing.ts'
import { displayWidth, toDisplayCells } from './display-width.ts'
import { gridToDrawingCoord } from './grid.ts'
import { splitLines } from './multiline-utils.ts'
import { drawLine } from './draw-lines.ts'

/**
 * Draw a complete arrow (edge) between two nodes.
 * Returns 6 separate canvases for layered compositing:
 * [path, boxStart, arrowHeadEnd, arrowHeadStart, corners, label]
 *
 * Supports bidirectional arrows via edge.hasArrowStart and edge.hasArrowEnd.
 */
export function drawArrow(
  graph: AsciiGraph,
  edge: AsciiEdge,
): [Canvas, Canvas, Canvas, Canvas, Canvas, Canvas] {
  if (edge.path.length === 0) {
    const empty = copyCanvas(graph.canvas)
    return [empty, empty, empty, empty, empty, empty]
  }

  const labelCanvas = drawArrowLabel(graph, edge)
  const wallEnd = clusterWallEnd(graph, edge)
  const wallStart = clusterWallStart(graph, edge)
  const drop = wallEnd
    ? clusterEntryDrop(graph, edge, wallEnd)
    : clusterExitDrop(graph, edge, wallStart)
  const dx = strokeShift(graph, edge)
  const shifts =
    edgePointShifts(graph, edge) ??
    (dx === 0 ? undefined : edge.path.map(() => ({ x: dx, y: 0 })))
  const [pathCanvas, linesDrawn, lineDirs] = drawPath(
    graph,
    edge.path,
    edge.style,
    wallEnd,
    drop,
    shifts,
    wallStart,
  )

  // A routed path can collapse to zero drawn line segments when every grid
  // point maps to the same drawing coordinate — e.g. a routed edge whose
  // preferred from/to grid coordinates coincide for closely-spaced/adjacent
  // nodes (pathfinder.ts's getPath can legitimately return a single-point
  // path in that case; see #153). With no segment to anchor to, there's
  // nothing for a box-start connector or an end arrowhead to attach to, so
  // both are skipped instead of indexing into the empty linesDrawn/lineDirs
  // arrays.
  const hasSegments = linesDrawn.length > 0

  /*
   * An invisible link (`A ~~~ B`) routes and reserves space like any other
   * edge, but must leave no mark. drawPath already writes spaces for its
   * segments; the box connector and corner glyphs are drawn by separate
   * passes that don't consult the line character set, so they're suppressed
   * explicitly here. Arrowheads need no guard — `~~~` carries no `>`/`o`/`x`
   * marker, so hasArrowStart/hasArrowEnd are already false.
   */
  const invisible = edge.style === 'invisible'

  const boxStartCanvas =
    hasSegments && !invisible && (!edge.hasArrowStart || wallStart)
      ? drawBoxStart(
          graph,
          edge.path,
          linesDrawn[0]!,
          edge.from,
          wallStart && {
            x: wallStart.x + strokeShift(graph, edge),
            y: wallStart.y,
          },
        )
      : copyCanvas(graph.canvas)

  // An arrowless end has no glyph to bridge the last cell to the target's
  // border, which leaves a gap under a dotted stroke (┆ doesn't fill its
  // cell): tee into the border like the start does.
  if (!edge.hasArrowEnd && hasSegments && !invisible) {
    drawBoxEnd(
      graph,
      boxStartCanvas,
      linesDrawn[linesDrawn.length - 1]!,
      lineDirs[lineDirs.length - 1]!,
    )
  }

  // Draw end arrowhead only if hasArrowEnd is true (default behavior)
  let arrowHeadEndCanvas: Canvas
  if (edge.hasArrowEnd && hasSegments) {
    arrowHeadEndCanvas = drawArrowHead(
      graph,
      linesDrawn[linesDrawn.length - 1]!,
      lineDirs[lineDirs.length - 1]!,
      edge.endMarker,
    )
  } else {
    arrowHeadEndCanvas = copyCanvas(graph.canvas)
  }

  // Draw start arrowhead for bidirectional edges, in the first stroke cell
  // (one cell out from the source border, mirroring the end head) so the
  // border stays intact and untee'd, like the end side's (#1438).
  let arrowHeadStartCanvas: Canvas
  if (edge.hasArrowStart && hasSegments) {
    arrowHeadStartCanvas = drawArrowHead(
      graph,
      [linesDrawn[0]![0]!],
      reverseDirection(lineDirs[0]!),
      edge.startMarker,
    )
  } else {
    arrowHeadStartCanvas = copyCanvas(graph.canvas)
  }

  const cornersCanvas = invisible
    ? copyCanvas(graph.canvas)
    : drawCorners(graph, edge.path, drop, shifts)

  return [
    pathCanvas,
    boxStartCanvas,
    arrowHeadEndCanvas,
    arrowHeadStartCanvas,
    cornersCanvas,
    labelCanvas,
  ]
}

/**
 * Reverse a direction (for bidirectional arrow start heads).
 */
function reverseDirection(dir: Direction): Direction {
  if (dirEquals(dir, Up)) return Down
  if (dirEquals(dir, Down)) return Up
  if (dirEquals(dir, Left)) return Right
  if (dirEquals(dir, Right)) return Left
  if (dirEquals(dir, UpperLeft)) return LowerRight
  if (dirEquals(dir, UpperRight)) return LowerLeft
  if (dirEquals(dir, LowerLeft)) return UpperRight
  if (dirEquals(dir, LowerRight)) return UpperLeft
  return Middle
}

/**
 * Where a cluster-entry edge (`edge.clusterEntered`) ends: on the cluster's
 * flow-side wall, in the column (row) of its gutter cell, so the arrowhead
 * lands one cell outside it. Undefined for every other edge, and when the
 * wall isn't past the point the last leg starts from (the path then ends
 * where it is). Measured from that point, not from the gutter cell: at tight
 * padding the gutter cell can sit on or past the wall while the leg still
 * has room to reach it.
 */
function clusterWallEnd(
  graph: AsciiGraph,
  edge: AsciiEdge,
): DrawingCoord | undefined {
  const end = routedWallEnd(graph, edge)
  const sg = edge.clusterTarget
  if (!end || !sg) return end
  const landing = entryLandings(graph, sg).get(edge)
  if (landing === undefined) return end
  return graph.config.graphDirection === 'LR'
    ? { x: end.x, y: landing }
    : { x: landing, y: end.y }
}

/**
 * Where an engaged cluster exit (#1330) starts: on the cluster's flow-side
 * wall, in the stub's own column (row), instead of on
 * the stand-in member's face. The box-start connector then lands on the
 * wall (`┬`), so the edge reads as leaving the cluster and the member's own
 * border stays intact. Undefined for every other edge. The planner puts the
 * gutter cell past the wall (`planClusterExits`), so the first leg always
 * runs on beyond it.
 */
function clusterWallStart(
  graph: AsciiGraph,
  edge: AsciiEdge,
): DrawingCoord | undefined {
  const sg = edge.clusterSource
  if (!sg || graph.clusterExitPlans?.get(sg)?.edges.has(edge) !== true) {
    return undefined
  }
  // An engaged exit's path is the stub then the outside leg: >= 2 points.
  const start = gridToDrawingCoord(graph, edge.path[0]!)
  const landing = exitLandings(graph, sg).get(edge)
  return graph.config.graphDirection === 'LR'
    ? { x: sg.maxX, y: landing ?? start.y }
    : { x: landing ?? start.x, y: sg.maxY }
}

/**
 * Where each engaged exit of `sg` leaves along its flow-side wall (#1182).
 * Real mermaid clips every edge at its own point on the cluster border; the
 * planner's shared stub puts them all on one cell. Each exit instead takes the
 * wall cell nearest its target's centre, in target order so the drops never
 * cross, kept apart by `PREFERRED_ENTRY_GAP` (or `MIN_ENTRY_GAP` when the wall
 * is narrow). A lane group (same stand-in and target) leaves together, so it
 * counts once. Empty (no override: all share the stub's cell) when the wall is
 * too narrow to give each exit its own cell. Like entry landings this is
 * drawn, not routed, so occupancy is unchanged.
 */
function exitLandings(
  graph: AsciiGraph,
  sg: AsciiSubgraph,
): Map<AsciiEdge, number> {
  const landings = new Map<AsciiEdge, number>()
  const plan = graph.clusterExitPlans?.get(sg)
  if (!plan) return landings
  const lr = graph.config.graphDirection === 'LR'

  const units = new Map<unknown, AsciiEdge[]>()
  for (const edge of plan.edges) {
    const key = edge.parallelLane?.usedOffsets ?? edge
    const unit = units.get(key)
    if (unit) unit.push(edge)
    else units.set(key, [edge])
  }
  if (units.size < 2) return landings

  const ranked = [...units.values()]
    .map((edges) => {
      const to = requireGridCoord(edges[0]!.to)
      const centre = gridToDrawingCoord(
        graph,
        lr ? { x: to.x, y: to.y + 1 } : { x: to.x + 1, y: to.y },
      )
      return { edges, want: lr ? centre.y : centre.x }
    })
    // Stable, so exits aimed at the same cell keep edge order.
    .sort((a, b) => a.want - b.want)
  // A cell clear of the corner reads better than a tee beside it; a wall too
  // narrow for that settles for the cell next to the corner.
  const first = lr ? sg.minY : sg.minX
  const last = lr ? sg.maxY : sg.maxX
  let spread: number[] | undefined
  for (const inset of [2, 1]) {
    const lo = first + inset
    const hi = last - inset
    const wanted = ranked.map((r) => Math.min(hi, Math.max(lo, r.want)))
    spread =
      pushApart(wanted, lo, hi, PREFERRED_ENTRY_GAP) ??
      pushApart(wanted, lo, hi, MIN_ENTRY_GAP)
    if (spread) break
  }
  if (!spread) return landings
  ranked.forEach((r, i) => {
    for (const edge of r.edges) landings.set(edge, spread[i]!)
  })
  return landings
}

/**
 * The drawn shape of an engaged exit whose landing is not the stub's cell:
 * from its wall cell straight out to the gutter line, then on along the
 * routed outside leg. Mirrors `clusterEntryDrop`; undefined when the edge
 * starts where it was routed.
 */
function clusterExitDrop(
  graph: AsciiGraph,
  edge: AsciiEdge,
  start: DrawingCoord | undefined,
): EntryDrop | undefined {
  if (!start || edge.path.length < 2) return undefined
  const lr = graph.config.graphDirection === 'LR'
  const points = edge.path.map((p) => gridToDrawingCoord(graph, p))
  const stub = points[0]!
  if ((lr ? stub.y : stub.x) === (lr ? start.y : start.x)) return undefined

  const gutter = points[1]!
  const moved: DrawingCoord = lr
    ? { x: gutter.x, y: start.y }
    : { x: start.x, y: gutter.y }
  const rest = points.slice(2)
  // The routed leg left the gutter along the bus (or straight on, for a
  // collinear target); from the moved point it may now need an elbow.
  const next = rest[0]
  const elbow: DrawingCoord[] =
    next && next.x !== moved.x && next.y !== moved.y
      ? [lr ? { x: moved.x, y: next.y } : { x: next.x, y: moved.y }]
      : []
  // The landing can coincide with a routed corner, leaving a zero-length run
  // that `drawCorners` would read as a bend.
  const drawn = [start, moved, ...elbow, ...rest].filter(
    (p, i, all) => i === 0 || !drawingCoordEquals(p, all[i - 1]!),
  )
  return { points: drawn, jog: [moved, ...elbow] }
}

/** `clusterWallEnd` before any spreading: the gutter cell's own column (row). */
function routedWallEnd(
  graph: AsciiGraph,
  edge: AsciiEdge,
): DrawingCoord | undefined {
  const sg = edge.clusterTarget
  const last = edge.path[edge.path.length - 1]
  const prev = edge.path[edge.path.length - 2]
  if (!edge.clusterEntered || !sg || !last || !prev) return undefined
  const start = gridToDrawingCoord(graph, prev)
  const end = gridToDrawingCoord(graph, last)
  if (graph.config.graphDirection === 'LR') {
    return sg.minX > start.x ? { x: sg.minX, y: end.y } : undefined
  }
  return sg.minY > start.y ? { x: end.x, y: sg.minY } : undefined
}

/**
 * Where each entry into `sg` lands along its wall, for entries that would
 * otherwise share a landing cell or sit in adjacent ones. Real mermaid gives
 * every edge addressed to a cluster its own point on the border; routing
 * clamps each source's column (row) into the cluster's span, so when the
 * interior is narrow several sources collapse onto one cell and their
 * arrowheads merge. Entries are spread over the wall's interior in source
 * order, so the drops never cross. Empty (no override) when the routed
 * landings are already two or more cells apart, or when the wall is too
 * narrow to give every entry its own cell with a gap: those keep the routed
 * landing. The spread run is then centered on the entries' sources, so a
 * cluster fed from both sides gets landings balanced about its middle.
 */
function entryLandings(
  graph: AsciiGraph,
  sg: AsciiSubgraph,
): Map<AsciiEdge, number> {
  const lr = graph.config.graphDirection === 'LR'
  const group: { edge: AsciiEdge; at: number; from: number }[] = []
  for (const edge of graph.edges) {
    if (edge.clusterTarget !== sg) continue
    const end = routedWallEnd(graph, edge)
    const source = edge.path[0]
    if (!end || !source) continue
    const origin = gridToDrawingCoord(graph, source)
    group.push({
      edge,
      at: lr ? end.y : end.x,
      from: lr ? origin.y : origin.x,
    })
  }
  const landings = new Map<AsciiEdge, number>()
  if (group.length < 2) return landings

  // Array.prototype.sort is stable, so equal source positions keep edge order.
  group.sort((a, b) => a.from - b.from)
  const spaced = group.map((g) => g.at)
  if (spaced.every((at, i) => i === 0 || at - spaced[i - 1]! >= 2)) {
    return landings
  }

  // Two empty cells between arrowheads read better than one; a wall too
  // narrow for that settles for one, and one too narrow even for that keeps
  // the routed landings.
  const lo = lr ? sg.minY + 1 : sg.minX + 1
  const hi = lr ? sg.maxY - 1 : sg.maxX - 1
  const pushed =
    pushApart(spaced, lo, hi, PREFERRED_ENTRY_GAP) ??
    pushApart(spaced, lo, hi, MIN_ENTRY_GAP)
  if (!pushed) return landings

  // The run only moved as far as it had to, which can leave it hugging one
  // side while its sources sit evenly about the cluster. Slide it, rigid, to
  // center on the sources' midpoint, as far as the wall allows.
  const mid = (xs: number[]): number => (xs[0]! + xs[xs.length - 1]!) / 2
  const slide = Math.round(mid(group.map((g) => g.from)) - mid(pushed))
  const shift = Math.max(lo - pushed[0]!, Math.min(hi - pushed.at(-1)!, slide))
  group.forEach((g, i) => landings.set(g.edge, pushed[i]! + shift))
  return landings
}

/** Cells between the landings of two entries into one wall: preferred, minimum. */
const PREFERRED_ENTRY_GAP = 3
const MIN_ENTRY_GAP = 2

/**
 * Move sorted `positions` as little as needed to be at least `gap` apart and
 * inside `[lo, hi]`: a forward pass clears each from the one before it, a
 * backward pass pulls the run back inside the wall. Undefined when they do
 * not fit.
 */
function pushApart(
  positions: number[],
  lo: number,
  hi: number,
  gap: number,
): number[] | undefined {
  const out = [...positions]
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.max(out[i]!, i === 0 ? lo : out[i - 1]! + gap)
  }
  for (let i = out.length - 1; i >= 0; i--) {
    out[i] = Math.min(out[i]!, i === out.length - 1 ? hi : out[i + 1]! - gap)
  }
  return out[0]! < lo ? undefined : out
}

/**
 * The drawn shape of a cluster-entry edge that does not run straight into
 * the wall at its routed gutter column (row) (#1181). Two things cause it: a
 * source off the landing column, whose routed path jogs along the gutter, and
 * a landing that `entryLandings` moved so entries do not share an arrowhead.
 * Either way the edge is drawn from its first point down to the gutter,
 * along the gutter to its landing, and onto the wall, so its arrowhead points
 * into the cluster like its siblings'. The jog is kept two cells clear of the
 * wall (`turn`) so the arrowhead has its own cell between the jog and the
 * wall. Everything past the gutter is drawn, not routed, so occupancy is
 * unchanged.
 */
interface EntryDrop {
  /** Drawn polyline: source side, gutter arrival, jog end, wall cell. */
  points: DrawingCoord[]
  /** The drawn jog along the gutter: where a label sits. */
  jog: DrawingCoord[]
}

function clusterEntryDrop(
  graph: AsciiGraph,
  edge: AsciiEdge,
  end: DrawingCoord,
): EntryDrop | undefined {
  const last = edge.path[edge.path.length - 1]
  if (!last || edge.path.length < 2) return undefined
  const lr = graph.config.graphDirection === 'LR'
  const gutter = gridToDrawingCoord(graph, last)
  const start = gridToDrawingCoord(graph, edge.path[0]!)
  const turn = lr
    ? Math.min(gutter.x, end.x - 2)
    : Math.min(gutter.y, end.y - 2)
  // No room between the source and the wall for a jog and an arrowhead:
  // leave the edge as routed.
  if (turn <= (lr ? start.x : start.y)) return undefined

  // The first routed point on the gutter line is where the edge arrives; any
  // routed run along the gutter past it is replaced by the drawn jog.
  const line = lr ? last.x : last.y
  const arrival = edge.path.findIndex((p) => (lr ? p.x : p.y) === line)
  if (arrival < 1) return undefined
  const at = gridToDrawingCoord(graph, edge.path[arrival]!)
  const landing = lr ? end.y : end.x
  if ((lr ? at.y : at.x) === landing) return undefined

  const points = edge.path
    .slice(0, arrival)
    .map((p) => gridToDrawingCoord(graph, p))
  const joint: DrawingCoord = lr ? { x: turn, y: at.y } : { x: at.x, y: turn }
  const corner: DrawingCoord = lr
    ? { x: turn, y: landing }
    : { x: landing, y: turn }
  points.push(joint, corner, end)
  return { points, jog: [joint, corner] }
}

/**
 * Draw the path lines for an edge.
 * Returns the canvas, the coordinates drawn for each segment, and the direction of each segment.
 */
function drawPath(
  graph: AsciiGraph,
  path: GridCoord[],
  style: AsciiEdgeStyle = 'solid',
  endOverride?: DrawingCoord,
  drop?: EntryDrop,
  shifts?: DrawingCoord[],
  startOverride?: DrawingCoord,
): [Canvas, DrawingCoord[][], Direction[]] {
  const canvas = copyCanvas(graph.canvas)
  // path is non-empty: drawArrow (drawPath's sole caller) already returns
  // early when edge.path.length === 0.
  let previousCoord = path[0]!
  const linesDrawn: DrawingCoord[][] = []
  const lineDirs: Direction[] = []
  // #1284/#1350: strokes that share a port are drawn off the port centre;
  // `shifts[i]` is the offset of path point i.
  const shift = (c: DrawingCoord, i: number): DrawingCoord => {
    const by = shifts?.[i]
    return by === undefined || (by.x === 0 && by.y === 0)
      ? c
      : { x: c.x + by.x, y: c.y + by.y }
  }

  if (drop) {
    for (let i = 1; i < drop.points.length; i++) {
      const from = drop.points[i - 1]!
      const to = drop.points[i]!
      if (drawingCoordEquals(from, to)) continue
      const segment = drawLine(
        canvas,
        from,
        to,
        1,
        -1,
        graph.config.useAscii,
        style,
      )
      if (segment.length === 0) segment.push(from)
      linesDrawn.push(segment)
      lineDirs.push(determineDirection(from, to))
    }
    return [canvas, linesDrawn, lineDirs]
  }

  for (let i = 1; i < path.length; i++) {
    const nextCoord = path[i]!
    const prevDC = shift(
      startOverride && i === 1
        ? startOverride
        : gridToDrawingCoord(graph, previousCoord),
      i - 1,
    )
    const nextDC =
      endOverride && i === path.length - 1
        ? shift(endOverride, i)
        : shift(gridToDrawingCoord(graph, nextCoord), i)

    if (drawingCoordEquals(prevDC, nextDC)) {
      previousCoord = nextCoord
      continue
    }

    const dir = determineDirection(previousCoord, nextCoord)
    const segment = drawLine(
      canvas,
      prevDC,
      nextDC,
      1,
      -1,
      graph.config.useAscii,
      style,
    )
    if (segment.length === 0) segment.push(prevDC)
    linesDrawn.push(segment)
    lineDirs.push(dir)
    previousCoord = nextCoord
  }

  return [canvas, linesDrawn, lineDirs]
}

/** Vertical box-border characters a horizontal connector can genuinely merge with. */
const VERTICAL_BORDER_CHARS = new Set(['│', '┃', '║', '┆', '┊', '|', '‖'])
/** Horizontal box-border characters a vertical connector can genuinely merge with. */
const HORIZONTAL_BORDER_CHARS = new Set(['─', '━', '═', '╌', '┄', '-', '='])

/**
 * Draw the junction character where an edge exits the source node's box.
 * Unicode mode uses shape-specific T-junction glyphs; ASCII mode uses the
 * same universal '+' already used for corners in draw-boxes.ts.
 * Skips drawing for state pseudo-states which have their own visual borders.
 *
 * A tee/junction character (┬┴├┤) is only correct when it's actually merging
 * with a real perpendicular border line at that exact cell — e.g. a grid
 * column widened by a sibling edge's label can push the computed box-start
 * position away from the node's actual border, landing on a blank cell with
 * no vertical (or horizontal) line to justify a junction. In that case fall
 * back to a plain line character matching the edge's own direction, instead
 * of fabricating a stray tee (see issue #86).
 */
function drawBoxStart(
  graph: AsciiGraph,
  path: GridCoord[],
  firstLine: DrawingCoord[],
  sourceNode: AsciiNode,
  wallAt?: DrawingCoord,
): Canvas {
  const canvas = copyCanvas(graph.canvas)
  const useAscii = graph.config.useAscii

  // Skip box start connectors for state pseudo-states (they have their own
  // bordered design), unless the exit starts on a cluster wall (#1330).
  if (
    !wallAt &&
    (sourceNode.shape === 'state-start' || sourceNode.shape === 'state-end')
  ) {
    return canvas
  }

  // firstLine is guaranteed non-empty and path has >= 2 points: the sole
  // caller (drawArrow) only invokes drawBoxStart when drawPath produced at
  // least one line segment (see the `hasSegments` guard there), and
  // drawPath never pushes an empty segment into linesDrawn.
  const from = firstLine[0]!
  const dir = determineDirection(path[0]!, path[1]!)
  const junction = useAscii ? '+' : null

  // `canvas` (from copyCanvas) is a blank overlay layer — it never has
  // content of its own to check. Whether a genuine perpendicular border
  // line already occupies the target cell has to be read from
  // `graph.canvas`, which at this point in drawGraph already has node
  // boxes (and subgraph borders) merged onto it, before any edge layers.
  const existingOnBox = (x: number, y: number): string | undefined =>
    graph.canvas[x]?.[y]

  if (wallAt) {
    // A cluster exit (#1330) leaves through the cluster's own flow-side
    // wall, at the cell the path was started on: always a tee on that wall
    // (a stub runs Down in TD, Right in LR).
    const tee = dirEquals(dir, Down) ? '┬' : '├'
    write(canvas, wallAt.x, wallAt.y, junction ?? tee)
  } else if (dirEquals(dir, Up)) {
    const x = from.x
    const y = from.y + 1
    const existing = existingOnBox(x, y)
    const hasBorder =
      existing !== undefined && HORIZONTAL_BORDER_CHARS.has(existing)
    write(canvas, x, y, hasBorder ? (junction ?? '┴') : useAscii ? '|' : '│')
  } else if (dirEquals(dir, Down)) {
    const x = from.x
    const y = from.y - 1
    const existing = existingOnBox(x, y)
    const hasBorder =
      existing !== undefined && HORIZONTAL_BORDER_CHARS.has(existing)
    write(canvas, x, y, hasBorder ? (junction ?? '┬') : useAscii ? '|' : '│')
  } else if (dirEquals(dir, Left) || dirEquals(dir, Right)) {
    // Anchor horizontal connectors to the source node's *own* rendered
    // border column, not to gridToDrawingCoord's grid-column-centered
    // position. That position is centered within the node's border grid
    // column using that column's *allocated* width — but a sibling edge's
    // label can land on that same column (its labelLine's chosen segment
    // just happens to pass through the node's border column on its way
    // elsewhere) and widen it well past the 1-character width the border
    // itself needs. Centering on the inflated width then drags the
    // connector away from the box's actual border character, which stays
    // put at a position that only depends on the box's own dimensions.
    //
    // Node dimensions are set before edge routing/drawing (see
    // createMapping in grid.ts), so drawingCoord/drawing should always be
    // present here — but that's a cross-module invariant the type checker
    // can't see, so it's validated explicitly rather than trusted silently.
    const dc = sourceNode.drawingCoord
    const drawing = sourceNode.drawing
    if (dc === null || drawing === null) {
      /* v8 ignore next */
      throw new Error(
        `drawBoxStart: node "${sourceNode.name}" has no drawingCoord/drawing assigned`,
      )
    }
    const boxWidth = drawing.length
    const x = dirEquals(dir, Left) ? dc.x : dc.x + boxWidth - 1
    const y = from.y
    const existing = existingOnBox(x, y)
    const hasBorder =
      existing !== undefined && VERTICAL_BORDER_CHARS.has(existing)
    write(
      canvas,
      x,
      y,
      hasBorder
        ? (junction ?? (dirEquals(dir, Left) ? '┤' : '├'))
        : useAscii
          ? '-'
          : '─',
    )
  }

  return canvas
}

/**
 * Tee an arrowless edge end into the border it runs up to. Only fires when
 * the cell past the last stroke is a straight border facing the stroke, so a
 * diagonal or border-less end is left alone.
 */
function drawBoxEnd(
  graph: AsciiGraph,
  canvas: Canvas,
  lastLine: DrawingCoord[],
  dir: Direction,
): void {
  const last = lastLine[lastLine.length - 1]!
  const tee = [
    [Down, 0, 1, '┴', HORIZONTAL_BORDER_CHARS],
    [Up, 0, -1, '┬', HORIZONTAL_BORDER_CHARS],
    [Right, 1, 0, '┤', VERTICAL_BORDER_CHARS],
    [Left, -1, 0, '├', VERTICAL_BORDER_CHARS],
  ].find(([d]) => dirEquals(dir, d as Direction))
  /* v8 ignore next -- diagonal ends come only from determinePath's rare Case-4 fallback */
  if (!tee) return
  const [, dx, dy, glyph, borders] = tee as [
    Direction,
    number,
    number,
    string,
    ReadonlySet<string>,
  ]
  const x = last.x + dx
  const y = last.y + dy
  const existing = graph.canvas[x]?.[y]
  if (existing !== undefined && borders.has(existing)) {
    write(canvas, x, y, graph.config.useAscii ? '+' : glyph)
  }
}

/**
 * Fixed glyph for a `--o`/`--x` circle/cross terminator — direction-
 * independent, unlike the triangular arrowheads below, so callers don't
 * need to know which way the edge points to pick it. Returns undefined for
 * a plain arrowhead (no marker), so a caller can fall back to its own
 * directional glyph selection. Shared by drawArrowHead below (single-edge
 * arrowheads) and draw-bundles.ts (fan-in/fan-out bundled arrowheads) so
 * the glyph choice can't drift between the two. See issue #330.
 */
export function markerArrowChar(
  useAscii: boolean,
  marker: 'circle' | 'cross' | undefined,
): string | undefined {
  if (marker === 'circle') return useAscii ? 'o' : '○'
  if (marker === 'cross') return useAscii ? 'x' : '✕'
  return undefined
}

/**
 * Maps a direction to its Unicode arrowhead glyph, or `undefined` for a
 * direction with no arrowhead (`Middle`, or any other value this switch
 * doesn't recognize) — callers decide the ultimate fallback.
 *
 * Uses triangular Unicode symbols (▲▼◄►) for the four orthogonal
 * directions and diagonal arrow symbols (↗↖↘↙) for the four diagonal ones.
 * The diagonal glyphs are plain Arrows-block characters (U+2196–U+2199),
 * not filled triangles like the orthogonal set — JetBrains Mono NL (this
 * site's self-hosted ASCII font, see scripts/build-mono-font-subset.ts)
 * has no glyph at all for the filled diagonal triangles (◢◣◤◥, U+25E2–
 * U+25E5) that would otherwise match the orthogonal style; U+2196–U+2199
 * are real, correctly-directional glyphs the font does have, which beats
 * falling back to an unpinned system font for just these four characters.
 * See issue #1062.
 *
 * Exported (alongside {@link asciiArrowChar}) so tests can exercise every
 * direction directly — the ELK/pathfinder layout this module actually
 * draws from rarely if ever produces some direction combinations (e.g.
 * `LowerLeft` only arises from determinePath's rare Case-4 diagonal
 * fallback, and only for a specific relative source/target position no
 * existing sample or hand-written diagram happens to trigger), which would
 * otherwise leave this mapping's correctness for those directions unverified.
 */
export function unicodeArrowChar(dir: Direction): string | undefined {
  if (dirEquals(dir, Up)) return '▲'
  if (dirEquals(dir, Down)) return '▼'
  if (dirEquals(dir, Left)) return '◄'
  if (dirEquals(dir, Right)) return '►'
  if (dirEquals(dir, UpperRight)) return '↗'
  if (dirEquals(dir, UpperLeft)) return '↖'
  if (dirEquals(dir, LowerRight)) return '↘'
  if (dirEquals(dir, LowerLeft)) return '↙'
  return undefined
}

/** ASCII-mode counterpart of {@link unicodeArrowChar} — orthogonal only, no diagonals. */
export function asciiArrowChar(dir: Direction): string | undefined {
  if (dirEquals(dir, Up)) return '^'
  if (dirEquals(dir, Down)) return 'v'
  if (dirEquals(dir, Left)) return '<'
  if (dirEquals(dir, Right)) return '>'
  return undefined
}

/**
 * Draw the arrowhead at the end of an edge path.
 *
 * `marker` overrides the directional glyph with a fixed circle/cross glyph
 * for `--o`/`--x` (flowchart) terminators — those are direction-
 * independent, so the direction computed below is only used to place it,
 * never to pick which glyph to draw. See issue #330.
 */
function drawArrowHead(
  graph: AsciiGraph,
  lastLine: DrawingCoord[],
  fallbackDir: Direction,
  marker?: 'circle' | 'cross',
): Canvas {
  const canvas = copyCanvas(graph.canvas)
  if (lastLine.length === 0) return canvas

  // Direction is derived from the *final step* into `lastPos` (its
  // immediate predecessor in `lastLine`), not from `lastLine`'s first
  // point. Those coincide for an ordinary straight segment, but
  // `determinePath`'s Case-4 diagonal fallback (edge-routing.ts) can hand
  // drawLine a single non-axis-aligned pair, which it then draws as an L
  // (horizontal run, then vertical run — see draw-lines.ts) folded into
  // one `lastLine` array. Using the first point there would span both
  // legs and read as diagonal even when the actual approach into the
  // arrowhead is a plain orthogonal step. See issue #1083.
  const lastPos = lastLine[lastLine.length - 1]!
  const from =
    lastLine.length >= 2 ? lastLine[lastLine.length - 2]! : lastLine[0]!
  let dir = determineDirection(from, lastPos)
  if (lastLine.length === 1 || dirEquals(dir, Middle)) dir = fallbackDir

  const markerChar = markerArrowChar(graph.config.useAscii, marker)
  let char: string
  if (markerChar !== undefined) {
    char = markerChar
  } else if (!graph.config.useAscii) {
    const resolved = unicodeArrowChar(dir)
    // `resolved` is only ever undefined when `dir` itself is `Middle` (or
    // an unrecognized Direction) — which, given the reassignment above,
    // only happens when `fallbackDir` is itself `Middle`. No current
    // caller passes that; every drawArrow/draw-bundles.ts call site
    // computes a real directional fallback. Kept as a safety net rather
    // than a hard assumption.
    /* v8 ignore else */
    if (resolved !== undefined) {
      char = resolved
    } else {
      char = unicodeArrowChar(fallbackDir) ?? '●'
    }
  } else {
    const resolved = asciiArrowChar(dir)
    // Same defensive-only fallback as the unicode-mode branch above,
    // mirrored for ASCII mode.
    /* v8 ignore else */
    if (resolved !== undefined) {
      char = resolved
    } else {
      char = asciiArrowChar(fallbackDir) ?? '*'
    }
  }

  write(canvas, lastPos.x, lastPos.y, char)
  return canvas
}

/**
 * Draw corner characters at path bends (where the direction changes).
 * Uses ┌┐└┘ in Unicode mode, + in ASCII mode.
 */
function drawCorners(
  graph: AsciiGraph,
  path: GridCoord[],
  drop?: EntryDrop,
  shifts?: DrawingCoord[],
): Canvas {
  const canvas = copyCanvas(graph.canvas)
  // An entry drop (clusterEntryDrop) is already a drawn polyline.
  // Directions are read off grid coordinates for a routed path, as always.
  const points: { x: number; y: number }[] = drop ? drop.points : path

  for (let idx = 1; idx < points.length - 1; idx++) {
    const coord = points[idx]!
    const base = drop
      ? drop.points[idx]!
      : gridToDrawingCoord(graph, path[idx]!)
    const by = shifts?.[idx]
    const dc = by ? { x: base.x + by.x, y: base.y + by.y } : base
    const prevDir = determineDirection(points[idx - 1]!, coord)
    const nextDir = determineDirection(coord, points[idx + 1]!)

    let corner: string
    if (!graph.config.useAscii) {
      if (dirEquals(prevDir, nextDir)) {
        // A collinear interior point is not a bend. Ordinary paths are
        // merged (mergePath) so never have one; a cluster-exit path keeps
        // its gutter point when the target lies straight ahead
        // (cluster-boundary.ts). The line layer leaves this cell blank
        // (lines stop short of path vertices), so draw the straight glyph;
        // a sibling's fan-out corner here then merges into a tee.
        corner = dirEquals(prevDir, Up) || dirEquals(prevDir, Down) ? '│' : '─'
      } else if (
        (dirEquals(prevDir, Right) && dirEquals(nextDir, Down)) ||
        (dirEquals(prevDir, Up) && dirEquals(nextDir, Left))
      ) {
        corner = '┐'
      } else if (
        (dirEquals(prevDir, Right) && dirEquals(nextDir, Up)) ||
        (dirEquals(prevDir, Down) && dirEquals(nextDir, Left))
      ) {
        corner = '┘'
      } else if (
        (dirEquals(prevDir, Left) && dirEquals(nextDir, Down)) ||
        (dirEquals(prevDir, Up) && dirEquals(nextDir, Right))
      ) {
        corner = '┌'
      } else if (
        (dirEquals(prevDir, Left) && dirEquals(nextDir, Up)) ||
        (dirEquals(prevDir, Down) && dirEquals(nextDir, Right))
      ) {
        corner = '└'
      } else {
        corner = '+'
      }
    } else if (dirEquals(prevDir, nextDir)) {
      // Collinear, as above: ASCII has no tee glyph to merge into, so a
      // straight run just continues (a sibling's corner here is a `+`).
      corner = dirEquals(prevDir, Up) || dirEquals(prevDir, Down) ? '|' : '-'
    } else {
      corner = '+'
    }

    write(canvas, dc.x, dc.y, corner)
  }

  return canvas
}

/**
 * True when `edge` has a sibling edge connecting the exact same two nodes in
 * the opposite direction (`A --> B` alongside `B --> A`) — a "reciprocal
 * pair". Node identity is compared by reference: `converter.ts` resolves
 * every edge's `from`/`to` from the same shared node map, so the same
 * logical node is always the same object across edges.
 */
function hasReciprocalPartner(graph: AsciiGraph, edge: AsciiEdge): boolean {
  return graph.edges.some(
    (other) =>
      other !== edge && other.from === edge.to && other.to === edge.from,
  )
}

/**
 * #1284: a straight vertical reciprocal pair (`A --> B` + `B --> A`, one
 * grid column) keeps its single column, but the two strokes are drawn apart:
 * the down edge one cell right of the column centre (+1), the up edge one
 * cell left (-1). The labels then sit beside their own stroke. Returns 0 -
 * the strokes stay on the centre - unless the pair is straight and vertical,
 * both boxes are wide enough to hold two strokes, and every label has free
 * cells beside its stroke.
 */
export function strokeShift(graph: AsciiGraph, edge: AsciiEdge): 0 | 1 | -1 {
  return strokeShiftFor(graph, edge, true)
}

function strokeShiftFor(
  graph: AsciiGraph,
  edge: AsciiEdge,
  labelAware: boolean,
): 0 | 1 | -1 {
  const partner = verticalPairPartner(graph, edge)
  if (!partner) return 0
  // A pair that shares its port with other edges is spread by `portShifts`.
  const generic = portShifts(graph)
  if (generic.has(edge) || generic.has(partner)) return 0
  for (const e of [edge, partner]) {
    if (e.text.length === 0) continue
    const side = e.path[1]!.y > e.path[0]!.y ? 'right' : 'left'
    const beside = besideStroke(
      centredLabelPlacement(graph, e, labelAware),
      gridToDrawingCoord(graph, e.path[0]!).x + (side === 'right' ? 1 : -1),
      side,
    )
    if (!besideFree(graph, e, beside, labelAware)) return 0
  }
  return edge.path[1]!.y > edge.path[0]!.y ? 1 : -1
}

function verticalPairPartner(
  graph: AsciiGraph,
  edge: AsciiEdge,
): AsciiEdge | undefined {
  if (edge.from === edge.to || edge.path.length !== 2) return undefined
  const partner = graph.edges.find(
    (o) => o !== edge && o.from === edge.to && o.to === edge.from,
  )
  if (!partner || partner.path.length !== 2) return undefined
  if (isClusterExitEdge(graph, edge) || isClusterExitEdge(graph, partner)) {
    return undefined
  }
  const [a, b] = edge.path as [GridCoord, GridCoord]
  const [c, d] = partner.path as [GridCoord, GridCoord]
  if (a.x !== b.x || c.x !== d.x || a.x !== c.x || a.y === b.y) return undefined
  // Opposite directions, each box wide enough for two strokes (centre +-1
  // must stay inside the border, i.e. width >= 5).
  if (b.y > a.y === d.y > c.y) return undefined
  for (const n of [edge.from, edge.to]) {
    if (!n.drawing || n.drawing.length < 5) return undefined
  }
  return partner
}

/**
 * Where an edge's label goes, as the drawing-space cells its lines start at.
 * `null` for an unlabeled edge. The single source of truth for label
 * placement: `drawArrowLabel` draws from it, and cluster-boundary.ts
 * measures it to size a cluster-exit gutter that keeps the label clear of
 * the cluster wall and the arrowhead.
 */
export function edgeLabelPlacement(
  graph: AsciiGraph,
  edge: AsciiEdge,
): { x: number; y: number; text: string }[] | null {
  const placed = resolveLabelPlacement(graph, edge, true)
  return placed && clearOfEarlierLabels(graph, edge, placed)
}

/**
 * #1433: two edges that share their last vertical leg (a lane's drop into one
 * node) both resolve to the same cell, and `drawGraph` merges label overlays
 * last-wins, so one label vanished. Each label is resolved against the others
 * unmoved, so both see the clash and move identically; the later edge alone
 * slides along the shared stroke to the nearest rows no other label covers
 * (#1463: a later edge's label on the lane included, or the slide just trades
 * one overprint for another).
 */
function clearOfEarlierLabels(
  graph: AsciiGraph,
  edge: AsciiEdge,
  placement: { x: number; y: number; text: string }[],
): { x: number; y: number; text: string }[] {
  const line = onEntryJog(graph, edge, labelLineToDrawing(graph, edge))
  if (
    line.length < 2 ||
    line[0]!.x !== line[1]!.x ||
    isClusterExitEdge(graph, edge)
  ) {
    return placement
  }
  const at = graph.edges.indexOf(edge)
  const labelsOf = (edges: AsciiEdge[], labelAware: boolean) =>
    edges
      .filter((other) => other.path.length >= 2)
      .flatMap((other) => resolveLabelPlacement(graph, other, labelAware) ?? [])
  const earlier = labelsOf(graph.edges.slice(0, at), false)
  // A later label is taken where it will be drawn (label-aware, before its
  // own slide, which only ever looks at earlier ones: no cycle).
  const later = labelsOf(graph.edges.slice(at + 1), true)
  return slideClearOf(
    placement,
    earlier,
    Math.min(line[0]!.y, line[1]!.y),
    Math.max(line[0]!.y, line[1]!.y),
    later,
  )
}

/**
 * Shift `placement` along a vertical stroke spanning rows `lo`..`hi` to the
 * nearest rows strictly inside it (clear of both ends) that no label in
 * `taken` or `avoid` covers, staying put when it already clears `taken` (or
 * when no rows do).
 */
export function slideClearOf(
  placement: { x: number; y: number; text: string }[],
  taken: { x: number; y: number; text: string }[],
  lo: number,
  hi: number,
  avoid: { x: number; y: number; text: string }[] = [],
): { x: number; y: number; text: string }[] {
  const hits = (p: typeof placement, against = taken) =>
    p.some((a) =>
      against.some(
        (b) =>
          a.y === b.y &&
          a.x <= b.x + displayWidth(b.text) - 1 &&
          b.x <= a.x + displayWidth(a.text) - 1,
      ),
    )
  if (!hits(placement)) return placement
  for (let d = 1; d < hi - lo; d++) {
    for (const dy of [d, -d]) {
      const moved = placement.map((p) => ({ ...p, y: p.y + dy }))
      const ys = moved.map((m) => m.y)
      if (Math.min(...ys) <= lo || Math.max(...ys) >= hi) continue
      if (!hits(moved, [...taken, ...avoid])) return moved
    }
  }
  return placement
}

/**
 * `edgeLabelPlacement`'s body. `labelAware` says whether the beside-stroke
 * candidates are also checked against the other edges' labels (#1338). Those
 * labels are themselves resolved with `labelAware = false` (see
 * `otherLabelPlacements`), so the check never recurses and never depends on
 * the order the edges are drawn in.
 */
function resolveLabelPlacement(
  graph: AsciiGraph,
  edge: AsciiEdge,
  labelAware: boolean,
): { x: number; y: number; text: string }[] | null {
  if (edge.text.length === 0) return null
  const centred = centredLabelPlacement(graph, edge, labelAware)
  const dx = strokeShiftFor(graph, edge, labelAware)
  // #1408 option C: a vertical edge's label goes on its own stroke when the
  // gap and the cells around it allow; otherwise the placement below stands.
  const onStroke = onStrokePlacement(graph, edge, labelAware, dx, centred)
  if (onStroke) return onStroke
  if (dx === 0) return centred
  // #1284: the pair's strokes are drawn one cell either side of the column
  // centre (see strokeShift), so each label sits beside its own stroke,
  // clear of the other. strokeShift already checked these cells are free.
  return besideStroke(
    centred,
    gridToDrawingCoord(graph, edge.path[0]!).x + dx,
    dx > 0 ? 'right' : 'left',
  )
}

/**
 * #1408 option C: draw a vertical edge's label ON its stroke, centred on the
 * stroke column, the way Mermaid centres it on the line. Terminal cells have
 * no background fill, so the text replaces the stroke cells under it and the
 * stroke carries on above and below.
 *
 * Rules:
 * - Row: the gap midpoint for a lone edge; a reciprocal partner keeps the
 *   #530 row (`preferred`) so each label stays next to its own arrowhead.
 * - The label rows need a plain stroke cell between them and each node
 *   border (two clear rows; three where an arrowhead is drawn at that end),
 *   so a gap too short for that is not eligible and the placement that
 *   applied before (beside the stroke where free, else centred on it)
 *   stands.
 * - The text must sit on nothing else (node, subgraph wall or title, another
 *   edge's stroke - which keeps it off a bypass edge's junction row - or
 *   another label). Rows slide away from the preferred one to find such a
 *   spot, looking for one a cell clear of other strokes first.
 *
 * Returns null when no row qualifies (or, for a pair, when its partner has
 * none). Cluster-exit edges are not handled.
 */
function onStrokePlacement(
  graph: AsciiGraph,
  edge: AsciiEdge,
  labelAware: boolean,
  dx: number,
  preferred: { x: number; y: number; text: string }[],
  checkPartner = true,
): { x: number; y: number; text: string }[] | null {
  // A reciprocal pair goes on its strokes together or not at all, so one
  // label never sits on its stroke while the other sits beside its own.
  const partner = verticalPairPartner(graph, edge)
  if (
    checkPartner &&
    partner &&
    partner.text.length > 0 &&
    !onStrokePlacement(
      graph,
      partner,
      false,
      strokeShiftFor(graph, partner, false),
      centredLabelPlacement(graph, partner, false),
      false,
    )
  ) {
    return null
  }
  const line = onEntryJog(graph, edge, labelLineToDrawing(graph, edge))
  if (
    line.length < 2 ||
    line[0]!.x !== line[1]!.x ||
    line[0]!.y === line[1]!.y ||
    isClusterExitEdge(graph, edge)
  ) {
    return null
  }
  const strokeX = line[0]!.x + dx
  const lo = Math.min(line[0]!.y, line[1]!.y)
  const hi = Math.max(line[0]!.y, line[1]!.y)
  const lines = splitLines(edge.text)
  const span = lines.length - 1
  const paired = hasReciprocalPartner(graph, edge)
  // Rows to keep clear next to each border: one plain stroke cell, plus the
  // arrowhead's own cell when an arrowhead is drawn at that end. A pair's
  // labels stay on the #530 rows, next to their own arrowheads, so they only
  // keep the plain cell.
  const upward = line[1]!.y < line[0]!.y
  const arrow = paired ? 2 : 3
  const top = (upward ? edge.hasArrowEnd : edge.hasArrowStart) ? arrow : 2
  const bottom = (upward ? edge.hasArrowStart : edge.hasArrowEnd) ? arrow : 2
  const first = paired
    ? preferred[0]!.y
    : lo + Math.floor((hi - lo) / 2) - Math.floor(span / 2)
  const at = (y: number) =>
    lines.map((text, i) => ({
      x: strokeX - Math.floor(displayWidth(text) / 2),
      y: y + i,
      text,
    }))
  for (const clearance of [1, 0]) {
    for (let d = 0; d <= hi - lo; d++) {
      for (const y of d === 0 ? [first] : [first + d, first - d]) {
        if (y < lo + top || y + span > hi - bottom) continue
        const placement = at(y)
        if (besideFree(graph, edge, placement, labelAware, clearance)) {
          return placement
        }
      }
    }
  }
  return null
}

function centredLabelPlacement(
  graph: AsciiGraph,
  edge: AsciiEdge,
  labelAware: boolean,
): { x: number; y: number; text: string }[] {
  const drawingLine = onEntryJog(graph, edge, labelLineToDrawing(graph, edge))

  // Determine if this is an upward edge (target is above source in the path)
  // This is used to offset labels on bidirectional edges to prevent overlap
  let isUpwardEdge: boolean | undefined
  if (edge.path.length >= 2) {
    const startY = edge.path[0]!.y
    const endY = edge.path[edge.path.length - 1]!.y
    // Edge goes up if end Y is less than start Y (smaller Y = higher on screen)
    if (endY < startY) {
      isUpwardEdge = true
    } else if (endY > startY) {
      isUpwardEdge = false
    }
    // If endY === startY, it's horizontal, leave isUpwardEdge undefined
  }

  // Only a genuine reciprocal pair (A-->B alongside B-->A) needs its label
  // pulled toward its own target instead of its own source — see #530 and
  // labelTextPlacement's doc comment below. A lone vertical edge keeps the
  // original "precede the arrow, near the source" placement.
  //
  // A TD cluster-exit edge whose first outside leg is vertical (its target
  // lies straight below the stub) also pulls toward its target: the fan-out
  // siblings put their labels on the gutter row, and a near-source label
  // here would land on that same row, so `done` and `fail` would read as one
  // run (`done────fail`). Pulled down, each label sits on its own segment.
  const pullTowardTarget =
    hasReciprocalPartner(graph, edge) ||
    (graph.config.graphDirection !== 'LR' &&
      edge.clusterSource !== undefined &&
      graph.clusterExitPlans?.get(edge.clusterSource)?.edges.has(edge) === true)

  const centred = clearOfJoiningStrokes(
    graph,
    edge,
    drawingLine,
    clearOfLaneJunction(
      graph,
      edge,
      clearOfSubgraphTitles(
        graph,
        clearOfClusterWalls(
          graph,
          labelTextPlacement(
            drawingLine,
            edge.text,
            isUpwardEdge,
            pullTowardTarget,
            edge.hasArrowStart && edge.hasArrowEnd,
          ),
          drawingLine[0]?.x === drawingLine[1]?.x
            ? drawingLine[0]?.x
            : undefined,
        ),
        drawingLine,
      ),
    ),
  )

  // #1284: every labelled vertical edge puts its label beside the stroke
  // instead of cutting through it, the down edge's to its right and the up
  // edge's to its left (a reciprocal pair shares one channel, so the two
  // sides also keep its labels apart). The row is the one chosen above (#530
  // pins it); only the column changes, and only when the cells beside the
  // stroke are clear — otherwise the label stays on the stroke.
  if (
    isUpwardEdge !== undefined &&
    drawingLine.length >= 2 &&
    drawingLine[0]!.x === drawingLine[1]!.x &&
    !isClusterExitEdge(graph, edge)
  ) {
    const beside = besideStroke(
      centred,
      drawingLine[0]!.x,
      isUpwardEdge ? 'left' : 'right',
    )
    if (besideFree(graph, edge, beside, labelAware)) {
      // Right beside another edge's stroke the label reads as that edge's
      // (#attribution). A label beside its own stroke has one blank cell to
      // it, so another stroke should be two or more away; failing that, one
      // blank cell clear. Slide along its own stroke to the nearest row that
      // manages it, keeping off the stroke's two ends.
      const top = Math.min(drawingLine[0]!.y, drawingLine[1]!.y) + 1
      const bottom = Math.max(drawingLine[0]!.y, drawingLine[1]!.y) - 1
      const rows = beside.map((b) => b.y)
      const span = Math.max(...rows) - Math.min(...rows)
      for (const clearance of [2, 1]) {
        if (besideFree(graph, edge, beside, labelAware, clearance))
          return beside
        for (let d = 1; d <= bottom - top; d++) {
          for (const dy of [d, -d]) {
            const moved = beside.map((b) => ({ ...b, y: b.y + dy }))
            const first = Math.min(...moved.map((m) => m.y))
            if (first < top || first + span > bottom) continue
            if (besideFree(graph, edge, moved, labelAware, clearance))
              return moved
          }
        }
      }
      return beside
    }
  }
  return clearOfSiblingStrokes(graph, edge, drawingLine, centred, labelAware)
}

/**
 * A label centred on a vertical stroke can reach across to a sibling stroke
 * that leaves the same node a few cells over (a fan-out's port-shifted stems)
 * and overwrite it, leaving that edge without a visible path. Slide the text
 * sideways to the nearest column where it sits on no other edge; it stays
 * where it is when nothing is free.
 */
function clearOfSiblingStrokes(
  graph: AsciiGraph,
  edge: AsciiEdge,
  line: DrawingCoord[],
  placement: { x: number; y: number; text: string }[],
  labelAware: boolean,
): { x: number; y: number; text: string }[] {
  if (
    line.length < 2 ||
    isClusterExitEdge(graph, edge) ||
    besideFree(graph, edge, placement, labelAware)
  ) {
    return placement
  }
  const width = Math.max(...placement.map((p) => displayWidth(p.text)))
  if (
    graph.config.graphDirection === 'LR' &&
    line[0]!.y === line[1]!.y &&
    line[0]!.x !== line[1]!.x
  ) {
    // #1433: the LR mirror. A label centred on a horizontal run can cover a
    // sibling's drop stem that leaves the same node a few cells over. Slide
    // along the run, then try the row above and below it, to the nearest spot
    // that sits on no other edge; the first and last run cells stay clear
    // (border / arrowhead).
    const lo = Math.min(line[0]!.x, line[1]!.x) + 1
    const hi = Math.max(line[0]!.x, line[1]!.x) - 1
    for (const dy of [0, -1, 1]) {
      for (const clearance of [1, 0]) {
        for (let d = 0; d <= hi - lo; d++) {
          for (const dx of d === 0 ? [0] : [-d, d]) {
            const moved = placement.map((p) => ({
              ...p,
              x: p.x + dx,
              y: p.y + dy,
            }))
            const first = Math.min(...moved.map((m) => m.x))
            if (first < lo || first + width - 1 > hi) continue
            if (besideFree(graph, edge, moved, labelAware, clearance))
              return moved
          }
        }
      }
    }
    return placement
  }
  if (line[0]!.x !== line[1]!.x || line[0]!.y === line[1]!.y) return placement
  // One blank cell clear of the sibling first, so it doesn't read as the
  // label's own stroke; flush against it only when that is all there is.
  for (const clearance of [1, 0]) {
    for (let d = 1; d <= width + clearance; d++) {
      for (const dx of [-d, d]) {
        const moved = placement.map((p) => ({ ...p, x: p.x + dx }))
        if (besideFree(graph, edge, moved, labelAware, clearance, true)) {
          return moved
        }
      }
    }
  }
  // No column is free: slide along the stroke to a row where the label sits
  // clear (a fan-in's landing strokes can box in the middle of a short stem).
  const lo = Math.min(line[0]!.y, line[1]!.y) + 1
  const hi = Math.max(line[0]!.y, line[1]!.y) - 2
  const rows = placement.map((p) => p.y)
  const span = Math.max(...rows) - Math.min(...rows)
  for (let d = 1; d <= hi - lo; d++) {
    for (const dy of [-d, d]) {
      const first = Math.min(...rows) + dy
      if (first < lo || first + span > hi) continue
      const moved = placement.map((p) => ({ ...p, y: p.y + dy }))
      if (besideFree(graph, edge, moved, labelAware)) return moved
    }
  }
  return placement
}

function isClusterExitEdge(graph: AsciiGraph, edge: AsciiEdge): boolean {
  return (
    edge.clusterSource !== undefined &&
    graph.clusterExitPlans?.get(edge.clusterSource)?.edges.has(edge) === true
  )
}

/**
 * Re-anchor label lines so they sit beside a vertical stroke at column
 * `strokeX`, one blank cell clear of it: starting at `strokeX + 2` for the
 * right side, ending at `strokeX - 2` for the left. Rows are kept.
 */
function besideStroke(
  placement: { x: number; y: number; text: string }[],
  strokeX: number,
  side: 'left' | 'right',
): { x: number; y: number; text: string }[] {
  return placement.map((item) => ({
    ...item,
    x: side === 'right' ? strokeX + 2 : strokeX - 1 - displayWidth(item.text),
  }))
}

/**
 * Whether label text at `placement` sits on nothing else the layout has
 * already fixed: inside the canvas's left edge, off every node box, off every
 * subgraph wall and title row, and off every other edge's path. Pure
 * geometry, so it also works where no canvas is drawn yet.
 */
export function besideCellsFree(
  graph: AsciiGraph,
  edge: AsciiEdge,
  placement: { x: number; y: number; text: string }[],
  clearance = 0,
): boolean {
  return besideFree(graph, edge, placement, true, clearance)
}

function besideFree(
  graph: AsciiGraph,
  edge: AsciiEdge,
  placement: { x: number; y: number; text: string }[],
  labelAware: boolean,
  clearance = 0,
  sidewaysOnly = false,
): boolean {
  return (
    besideGeometryFree(graph, edge, placement, clearance, sidewaysOnly) &&
    (!labelAware || !hitsOtherLabel(graph, edge, placement))
  )
}

/**
 * #1338: whether any line of `placement` shares a cell with another edge's
 * label. `drawGraph` merges label overlays last-wins, so an overlap would
 * overwrite text.
 */
function hitsOtherLabel(
  graph: AsciiGraph,
  edge: AsciiEdge,
  placement: { x: number; y: number; text: string }[],
): boolean {
  const others = otherLabelPlacements(graph, edge)
  return placement.some((a) =>
    others.some(
      (b) =>
        a.y === b.y &&
        a.x <= b.x + displayWidth(b.text) - 1 &&
        b.x <= a.x + displayWidth(a.text) - 1,
    ),
  )
}

/**
 * Every other labelled edge's label lines, placed without the label check
 * (`labelAware = false`) so this stays a pure function of the layout.
 */
function otherLabelPlacements(
  graph: AsciiGraph,
  edge: AsciiEdge,
): { x: number; y: number; text: string }[] {
  const out: { x: number; y: number; text: string }[] = []
  const shifts = portShifts(graph)
  const at = graph.edges.indexOf(edge)
  for (const [i, other] of graph.edges.entries()) {
    if (other === edge || other.path.length < 2) continue
    // #1455: side-by-side siblings (same ends, both spread) stagger instead of
    // all sliding to the same row: a later sibling yields to this label, an
    // earlier one is taken where it is drawn (strictly earlier, so no cycle).
    const sibling =
      other.from === edge.from &&
      other.to === edge.to &&
      shifts.has(edge) &&
      shifts.has(other)
    if (sibling && i > at) continue
    out.push(...(resolveLabelPlacement(graph, other, sibling) ?? []))
  }
  return out
}

function besideGeometryFree(
  graph: AsciiGraph,
  edge: AsciiEdge,
  placement: { x: number; y: number; text: string }[],
  clearance = 0,
  sidewaysOnly = false,
): boolean {
  for (const { x, y, text } of placement) {
    const x0 = x
    const x1 = x + displayWidth(text) - 1
    if (x0 < 0) return false
    for (const node of graph.nodes) {
      if (!node.drawingCoord || !node.drawing) continue
      const nx = node.drawingCoord.x
      const ny = node.drawingCoord.y
      if (
        x1 >= nx &&
        x0 < nx + node.drawing.length &&
        y >= ny &&
        y < ny + (node.drawing[0]?.length ?? 0)
      ) {
        return false
      }
    }
    for (const sg of graph.subgraphs) {
      if (sg.nodes.length === 0) continue
      const titleRows = splitLines(sg.name).length
      const inRows = y >= sg.minY && y <= sg.maxY
      const crossesSide = [sg.minX, sg.maxX].some((w) => w >= x0 && w <= x1)
      if (inRows && crossesSide) return false
      const onTopOrBottom =
        y === sg.maxY || (y >= sg.minY && y <= sg.minY + titleRows)
      if (onTopOrBottom && x1 >= sg.minX && x0 <= sg.maxX) return false
    }
    for (const other of graph.edges) {
      if (other === edge) continue
      const pts = pathToDrawing(graph, other)
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!
        const b = pts[i]!
        // `clearance` keeps the text off cells *next to* another edge's
        // stroke too, where it would read as that stroke's label (#attribution).
        // `sidewaysOnly` counts it only across columns: a label already on its
        // own stroke can't be misread, and a stroke on the row above or below
        // ruled out the one-cell gap beside a stem whenever a junction row sat
        // right below (#1434).
        const rowClearance = sidewaysOnly ? 0 : clearance
        if (
          y >= Math.min(a.y, b.y) - rowClearance &&
          y <= Math.max(a.y, b.y) + rowClearance &&
          x1 >= Math.min(a.x, b.x) - clearance &&
          x0 <= Math.max(a.x, b.x) + clearance
        ) {
          return false
        }
      }
    }
  }
  return true
}

/**
 * A label on the jog of a cluster entry that drops onto the wall
 * (`clusterEntryDrop`) follows the jog to where it is drawn, instead of
 * staying on the stretch of gutter row (column) it was routed along: that
 * stretch can be the arrowhead's own row, and once the landing has moved it
 * no longer spans the drawn jog.
 */
function onEntryJog(
  graph: AsciiGraph,
  edge: AsciiEdge,
  line: DrawingCoord[],
): DrawingCoord[] {
  const end = clusterWallEnd(graph, edge)
  const drop = end ? clusterEntryDrop(graph, edge, end) : undefined
  const last = edge.path[edge.path.length - 1]
  if (!end && line.length >= 2) return onExitBus(graph, edge, line)
  if (!drop || !last || line.length < 2) return line
  const gutter = gridToDrawingCoord(graph, last)
  const lr = graph.config.graphDirection === 'LR'
  return line.every((c) => (lr ? c.x === gutter.x : c.y === gutter.y))
    ? drop.jog
    : line
}

/**
 * A label on the bus run of an exit that leaves the wall off its stub's cell
 * (`clusterExitDrop`) follows the run to where it is drawn: the run now starts
 * at the exit's own wall column (row), not the stub's, and a label centred on
 * the routed run would sit on the new corner. A label on any other leg stays.
 */
function onExitBus(
  graph: AsciiGraph,
  edge: AsciiEdge,
  line: DrawingCoord[],
): DrawingCoord[] {
  const drop = clusterExitDrop(graph, edge, clusterWallStart(graph, edge))
  if (!drop) return line
  const lr = graph.config.graphDirection === 'LR'
  const stub = gridToDrawingCoord(graph, edge.path[0]!)
  const bus = drop.jog[0]!
  if (!line.every((c) => (lr ? c.x === bus.x : c.y === bus.y))) return line
  return line.map((c) =>
    (lr ? c.y === stub.y : c.x === stub.x)
      ? lr
        ? { x: c.x, y: bus.y }
        : { x: bus.x, y: c.y }
      : c,
  )
}

/**
 * Keep label text off a subgraph's title rows (#1254). A label centred on a
 * vertical run that crosses a frame's header replaces a letter of the title
 * (`Two` -> `Txo`). Each line that lands on a title row, or the top border
 * above it, inside the frame's columns moves to the nearest row of its own segment that no title uses; a
 * label with no such row, or that touches no title, is left alone.
 */
function clearOfSubgraphTitles(
  graph: AsciiGraph,
  placement: { x: number; y: number; text: string }[],
  line: DrawingCoord[],
): { x: number; y: number; text: string }[] {
  if (line.length < 2 || graph.subgraphs.length === 0) return placement
  const loY = Math.min(line[0]!.y, line[1]!.y)
  const hiY = Math.max(line[0]!.y, line[1]!.y)
  const hitsTitle = (item: { x: number; y: number; text: string }, y: number) =>
    graph.subgraphs.some((sg) => {
      if (sg.nodes.length === 0) return false
      const rows = splitLines(sg.name).length
      return (
        y >= sg.minY &&
        y <= sg.minY + rows &&
        item.x <= sg.maxX &&
        item.x + displayWidth(item.text) - 1 >= sg.minX
      )
    })
  return placement.map((item) => {
    if (!hitsTitle(item, item.y)) return item
    let best: number | null = null
    for (let y = loY + 1; y < hiY; y++) {
      if (hitsTitle(item, y)) continue
      if (best === null || Math.abs(y - item.y) < Math.abs(best - item.y)) {
        best = y
      }
    }
    return best === null ? item : { ...item, y: best }
  })
}

/**
 * A label centred on a horizontal run another edge turns onto (a fan-in's
 * vertical stroke ending in a tee on this row) can cover the tee's cell and
 * erase the join (#1392). Slide the text to the nearest spot on the run that
 * clears every such column.
 */
function clearOfJoiningStrokes(
  graph: AsciiGraph,
  edge: AsciiEdge,
  line: DrawingCoord[],
  placement: { x: number; y: number; text: string }[],
): { x: number; y: number; text: string }[] {
  if (line.length < 2 || line[0]!.y !== line[1]!.y) return placement
  const lo = Math.min(line[0]!.x, line[1]!.x)
  const hi = Math.max(line[0]!.x, line[1]!.x)
  const gy = edge.labelLine[0]?.y
  const joins: number[] = []
  for (const other of graph.edges) {
    if (other === edge) continue
    // The drawn column, so a port-shifted stem's tee is found where it lands.
    const drawn = pathToDrawing(graph, other)
    other.path.forEach((p, i) => {
      if (i === 0 || i === other.path.length - 1 || p.y !== gy) return
      // A bend: the stroke arrives or leaves vertically.
      if (other.path[i - 1]!.y === p.y && other.path[i + 1]!.y === p.y) return
      const x = drawn[i]!.x
      if (x > lo && x < hi) joins.push(x)
    })
  }
  if (joins.length === 0) return placement
  return placement.map((item) => {
    const width = displayWidth(item.text)
    const hit = (x: number): boolean =>
      joins.some((j) => j >= x && j < x + width)
    // A label drawn off the run's own row can't cover a tee on it.
    if (item.y !== line[0]!.y || !hit(item.x)) return item
    let best: number | null = null
    for (let x = lo + 1; x + width - 1 < hi; x++) {
      if (hit(x)) continue
      if (best === null || Math.abs(x - item.x) < Math.abs(best - item.x)) {
        best = x
      }
    }
    return best === null ? item : { ...item, x: best }
  })
}

/**
 * In LR, a lane sibling of an engaged cluster exit (#1182) turns off the
 * gutter column's vertical and runs its label along the horizontal that
 * follows. Centred on a short run the text can start on that column and
 * overwrite the junction, so keep it one line cell clear. Everything else
 * is returned untouched.
 */
function clearOfLaneJunction(
  graph: AsciiGraph,
  edge: AsciiEdge,
  placement: { x: number; y: number; text: string }[],
): { x: number; y: number; text: string }[] {
  const plan = edge.clusterSource
    ? graph.clusterExitPlans?.get(edge.clusterSource)
    : undefined
  if (
    graph.config.graphDirection !== 'LR' ||
    !plan?.edges.has(edge) ||
    !edge.parallelLane ||
    edge.parallelLane.index === 0
  ) {
    return placement
  }
  const minX = gridToDrawingCoord(graph, plan.gutter).x + 2
  return placement.map((item) => (item.x < minX ? { ...item, x: minX } : item))
}

/**
 * Keep label text off a cluster's side walls. A line running one character
 * from a wall (an outside edge passing beside a cluster) centres a label
 * wider than that on the line, which overwrites the wall cell and leaves a
 * gap in it. Slide the text to the line's own side of the wall instead. Only for a
 * vertical line (`lineX`; a horizontal one is meant to cross the wall), and
 * a label whose line sits on the wall itself, or that doesn't reach a wall,
 * is left alone.
 */
function clearOfClusterWalls(
  graph: AsciiGraph,
  placement: { x: number; y: number; text: string }[],
  lineX: number | undefined,
): { x: number; y: number; text: string }[] {
  if (lineX === undefined) return placement
  return placement.map((item) => {
    const width = displayWidth(item.text)
    let { x } = item
    for (const sg of graph.subgraphs) {
      if (item.y <= sg.minY || item.y >= sg.maxY) continue
      for (const wall of [sg.minX, sg.maxX]) {
        if (wall < x || wall >= x + width || lineX === wall) continue
        x = lineX > wall ? wall + 1 : wall - width
      }
    }
    return x === item.x ? item : { ...item, x }
  })
}

/** Draw edge label text centered on the widest path segment. */
function drawArrowLabel(graph: AsciiGraph, edge: AsciiEdge): Canvas {
  const canvas = copyCanvas(graph.canvas)
  for (const { x, y, text } of edgeLabelPlacement(graph, edge) ?? []) {
    drawText(canvas, { x, y }, text)
  }
  return canvas
}

/**
 * Cells of `edge`'s drawn label that hold a literal space between two
 * characters of the text. `mergeCanvases` treats an overlay's space as
 * transparent, so a stroke the label sits on would show through the gap and
 * turn `long label` into `long─label` (#1348); the caller blanks these cells
 * after the merge, the way subgraph titles already do (#447).
 */
export function labelInteriorSpaces(
  graph: AsciiGraph,
  edge: AsciiEdge,
): DrawingCoord[] {
  const cells: DrawingCoord[] = []
  for (const { x, y, text } of edgeLabelPlacement(graph, edge) ?? []) {
    const glyphs = toDisplayCells(text)
    const first = glyphs.findIndex((g) => g !== ' ')
    const last = glyphs.findLastIndex((g) => g !== ' ')
    for (let i = first + 1; i < last; i++) {
      if (glyphs[i] === ' ') cells.push({ x: x + i, y })
    }
  }
  return cells
}

/**
 * Place text centered on a line segment defined by two drawing coordinates.
 * Supports multi-line labels.
 *
 * When isUpwardEdge is provided, offsets the label vertically to prevent
 * overlapping with labels from edges going the opposite direction:
 * - Upward edges: label placed in lower portion of segment (near its own
 *   source), unless `pullTowardTarget` is set — see below.
 * - Downward edges (isUpwardEdge=false): label placed in upper portion
 *   (near its own source), unless `pullTowardTarget` is set.
 * - No direction (isUpwardEdge=undefined): label centered (default)
 *
 * `pullTowardTarget` inverts both of the above, pulling the label toward
 * its own arrowhead (the edge's target end) instead of its source. This
 * only makes a visible difference for a genuine reciprocal pair sharing one
 * vertical channel (`A --> B` alongside `B --> A`, both routed through the
 * same column): pulling each label toward its own *source* there pulls it
 * right next to the *other* edge's arrowhead instead, since in a two-node
 * cycle one edge's source is the other edge's target. #530 is exactly that
 * bug — a same-pair bidirectional edge's two labels rendered swapped
 * relative to the arrowheads they sit beside. A lone edge (no reciprocal
 * partner) keeps the original near-source placement so its label still
 * reads as "preceding" its own arrow rather than crowding the arrowhead.
 */
function labelTextPlacement(
  line: DrawingCoord[],
  label: string,
  isUpwardEdge?: boolean,
  pullTowardTarget = false,
  bothHeads = false,
): { x: number; y: number; text: string }[] {
  if (line.length < 2) return []
  const minX = Math.min(line[0]!.x, line[1]!.x)
  const maxX = Math.max(line[0]!.x, line[1]!.x)
  const minY = Math.min(line[0]!.y, line[1]!.y)
  const maxY = Math.max(line[0]!.y, line[1]!.y)
  const middleX = minX + Math.floor((maxX - minX) / 2)
  let middleY = minY + Math.floor((maxY - minY) / 2)

  // Offset label vertically to prevent overlap on bidirectional edges
  // For vertical segments (same X), shift based on edge direction
  if (isUpwardEdge !== undefined && minX === maxX) {
    const segmentHeight = maxY - minY
    const offset = Math.max(1, Math.floor(segmentHeight / 4))
    // XOR: pullTowardTarget flips which portion each direction lands in.
    const towardMinY = pullTowardTarget ? isUpwardEdge : !isUpwardEdge
    if (towardMinY) {
      middleY = middleY - offset
    } else {
      middleY = middleY + offset
    }
  }

  // Support multi-line labels
  const lines = splitLines(label)
  const startY = middleY - Math.floor((lines.length - 1) / 2)

  // A horizontal edge with a head at each end centres the label between the
  // heads (border, head, ..., head, border), not on the border-to-border
  // midpoint, which sits half a cell off for an even-width label.
  const between = bothHeads && minY === maxY
  return lines.map((lineText, i) => ({
    x: between
      ? minX + 2 + Math.floor((maxX - minX - 3 - displayWidth(lineText)) / 2)
      : middleX - Math.floor(displayWidth(lineText) / 2),
    y: startY + i,
    text: lineText,
  }))
}
