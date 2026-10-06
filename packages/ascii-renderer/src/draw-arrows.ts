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
  const drop = wallEnd ? clusterEntryDrop(graph, edge, wallEnd) : undefined
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
    hasSegments && !invisible
      ? drawBoxStart(graph, edge.path, linesDrawn[0]!, edge.from)
      : copyCanvas(graph.canvas)

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

  // Draw start arrowhead for bidirectional edges
  // The start arrowhead needs to be at the box connector position (one step back
  // from the first line point), pointing into the source node.
  let arrowHeadStartCanvas: Canvas
  if (edge.hasArrowStart && hasSegments) {
    const firstLine = linesDrawn[0]!
    const firstPoint = firstLine[0]!
    const startDir = reverseDirection(lineDirs[0]!)

    // Calculate the box connector position (one step back from first point)
    const arrowPos: DrawingCoord = { x: firstPoint.x, y: firstPoint.y }
    if (dirEquals(lineDirs[0]!, Right)) arrowPos.x = firstPoint.x - 1
    else if (dirEquals(lineDirs[0]!, Left)) arrowPos.x = firstPoint.x + 1
    else if (dirEquals(lineDirs[0]!, Down)) arrowPos.y = firstPoint.y - 1
    else if (dirEquals(lineDirs[0]!, Up)) arrowPos.y = firstPoint.y + 1

    // Create a synthetic line ending at the arrow position for drawArrowHead
    const syntheticLine: DrawingCoord[] = [firstPoint, arrowPos]
    arrowHeadStartCanvas = drawArrowHead(
      graph,
      syntheticLine,
      startDir,
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
    const prevDC = shift(gridToDrawingCoord(graph, previousCoord), i - 1)
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
): Canvas {
  const canvas = copyCanvas(graph.canvas)
  const useAscii = graph.config.useAscii

  // Skip box start connectors for state pseudo-states (they have their own bordered design)
  if (sourceNode.shape === 'state-start' || sourceNode.shape === 'state-end') {
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

  if (dirEquals(dir, Up)) {
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
  return resolveLabelPlacement(graph, edge, true)
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

  const centred = clearOfLaneJunction(
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
        ),
        drawingLine[0]?.x === drawingLine[1]?.x ? drawingLine[0]?.x : undefined,
      ),
      drawingLine,
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
        if (besideFree(graph, edge, beside, labelAware, clearance)) return beside
        for (let d = 1; d <= bottom - top; d++) {
          for (const dy of [d, -d]) {
            const moved = beside.map((b) => ({ ...b, y: b.y + dy }))
            const first = Math.min(...moved.map((m) => m.y))
            if (first < top || first + span > bottom) continue
            if (besideFree(graph, edge, moved, labelAware, clearance)) return moved
          }
        }
      }
      return beside
    }
  }
  return centred
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
): boolean {
  return (
    besideGeometryFree(graph, edge, placement, clearance) &&
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
  for (const other of graph.edges) {
    if (other === edge || other.path.length < 2) continue
    out.push(...(resolveLabelPlacement(graph, other, false) ?? []))
  }
  return out
}

function besideGeometryFree(
  graph: AsciiGraph,
  edge: AsciiEdge,
  placement: { x: number; y: number; text: string }[],
  clearance = 0,
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
        if (
          y >= Math.min(a.y, b.y) - clearance &&
          y <= Math.max(a.y, b.y) + clearance &&
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
  if (!drop || !last || line.length < 2) return line
  const gutter = gridToDrawingCoord(graph, last)
  const lr = graph.config.graphDirection === 'LR'
  return line.every((c) => (lr ? c.x === gutter.x : c.y === gutter.y))
    ? drop.jog
    : line
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

  return lines.map((lineText, i) => ({
    x: middleX - Math.floor(displayWidth(lineText) / 2),
    y: startY + i,
    text: lineText,
  }))
}
