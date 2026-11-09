/**
 * Architecture layout on Mermaid's grid. `architecture-beta` places every
 * service by the ports its edges use (`a:R -- L:b` puts `b` one cell right of
 * `a`), so the cells are known before any layout runs (`MermaidNode.gridLayer`
 * / `gridOrder`, from `architectureToGraph`). ELK only had to rediscover them,
 * and did so with its own spacing, group chrome offsets and edge elbows. This
 * places each cell directly instead: a fixed pitch between cells, widened where
 * a group boundary falls between two columns or rows, and groups drawn as the
 * padded box around what they hold, as Mermaid does.
 */

import type {
  ArchitectureInitLayout,
  MermaidGraph,
  MermaidSubgraph,
  Point,
  PositionedEdge,
  PositionedGraph,
  PositionedGroup,
  PositionedNode,
} from '@zombie-mermaid/core'
import { measureTextWidth } from '@zombie-mermaid/core'
import { TILE } from '../architecture-icons.ts'
import { FONT_SIZES, FONT_WEIGHTS } from '../styles.ts'
import { DEFAULTS } from './constants.ts'

/** mermaid@12.3.0 defaults for `architecture.padding` / `iconSize` / `fontSize`. */
const DEFAULT_PADDING = 40
const DEFAULT_FONT_SIZE = 16
const DEFAULT_EDGE_MULTIPLIER = 1.5
/** Mermaid draws an architecture edge 3px wide (`archEdgeWidth`). */
const EDGE_WIDTH = '3'

/**
 * Every length that follows the `architecture` init keys, from mermaid@12.3.0
 * measured with each key swept (defaults in brackets):
 * - `pitch(e)`: centre-to-centre distance of neighbouring cells with `e` group
 *   borders between them. Free cells sit `iconSize * (1 + idealEdgeLengthMultiplier)`
 *   apart [200]. Across borders mermaid's force layout instead keeps a gap
 *   between boxes, about 77 at the default tile and 0.55 more per px of tile
 *   (fitted to tiles 20..120, within 8px), so the pitch is the tile, the gap and
 *   the group paddings crossed [one border 200, two 241.5, three 283], unless
 *   `multiplier * iconSize` is longer. It is no longer pinned to the free pitch:
 *   `padding: 10` gives 172 for one border. Below a multiplier of 1.5 the
 *   force layout also compresses the free pitch a little (up to 6px in 0.1..1).
 * - `groupPad`: a group border's distance from the services it holds, `padding`
 *   + 2.5 [42.5]; `nestedPad` around inner groups, `padding` + 1.5 [41.5].
 * - `labelDrop`: the bottom of a group below a service tile, `fontSize` + 1 [17];
 *   `labelReach` the label's bottom edge below its tile, `fontSize` + 8.5 [24.5].
 * - `labelWrap`: a service label wraps at 1.5 tiles.
 */
function metrics(layout: ArchitectureInitLayout | undefined) {
  const pad = layout?.padding ?? DEFAULT_PADDING
  const tile = layout?.iconSize ?? TILE
  const fontSize = layout?.fontSize ?? DEFAULT_FONT_SIZE
  const groupPad = pad + 2.5
  const nestedPad = pad + 1.5
  const multiplier =
    layout?.idealEdgeLengthMultiplier ?? DEFAULT_EDGE_MULTIPLIER
  const pitch = (borders: number): number => {
    if (borders === 0) return tile * (1 + multiplier)
    const gap = (borders === 1 ? 77.5 : 76.5) + 0.552 * (tile - TILE)
    const crossed =
      groupPad * Math.min(borders, 2) + nestedPad * Math.max(0, borders - 2)
    return Math.max(tile + gap + crossed, multiplier * tile)
  }
  return {
    pad,
    tile,
    fontSize,
    groupPad,
    nestedPad,
    pitch,
    labelDrop: fontSize + 1,
    labelReach: fontSize + 8.5,
    labelWrap: tile * 1.5,
  }
}
type Metrics = ReturnType<typeof metrics>

/** A label's width, scaled with `architecture.fontSize` from the default (16) the sizes below were measured at. */
const labelWidth = (text: string, fontSize: number): number =>
  measureTextWidth(
    text,
    FONT_SIZES.nodeLabel * (fontSize / DEFAULT_FONT_SIZE),
    FONT_WEIGHTS.nodeLabel,
  )

/** Break a label into lines no wider than `labelWrap`; a longer single word stays whole. */
function wrapLabel(label: string, m: Metrics): string[] {
  const lines: string[] = []
  for (const para of label.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (line && labelWidth(next, m.fontSize) > m.labelWrap) {
        lines.push(line)
        line = word
      } else line = next
    }
    lines.push(line)
  }
  return lines
}

interface Box {
  x: number
  y: number
  width: number
  height: number
}

const union = (a: Box | undefined, b: Box): Box => {
  if (!a) return b
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  }
}

/** Disconnected pieces each start at cell (0, 0); lay them out left to right. */
function separateComponents(
  graph: MermaidGraph,
  cell: Map<string, [number, number]>,
): void {
  const parent = new Map([...cell.keys()].map((id) => [id, id]))
  const find = (id: string): string => {
    let root = id
    while (parent.get(root) !== root) root = parent.get(root)!
    return root
  }
  for (const e of graph.edges) {
    if (parent.has(e.source) && parent.has(e.target))
      parent.set(find(e.source), find(e.target))
  }
  const members = new Map<string, string[]>()
  for (const id of cell.keys()) {
    const root = find(id)
    members.set(root, [...(members.get(root) ?? []), id])
  }
  let next = 0
  for (const ids of members.values()) {
    const left = Math.min(...ids.map((id) => cell.get(id)![0]))
    const right = Math.max(...ids.map((id) => cell.get(id)![0]))
    for (const id of ids) cell.get(id)![0] += next - left
    next += right - left + 1
  }
}

/** Every group that holds `id`, innermost first. */
function ancestors(sgs: MermaidSubgraph[], id: string): string[] {
  for (const sg of sgs) {
    if (sg.nodeIds.includes(id)) return [sg.id]
    const inner = ancestors(sg.children, id)
    if (inner.length > 0) return [...inner, sg.id]
  }
  return []
}

/**
 * Coordinate of each index on one axis: `pitch` apart, plus
 * `firstBorder` for the second group border between two neighbours and
 * `nestedPad` for each one beyond. Mermaid's fcose keeps 120px between the tiles of neighbours and 75px
 * (`nodeSeparation`) between a border and the next box, so one border (a service
 * next to a group) costs nothing, two (group beside group) +43 and three +80,
 * measured on mermaid@12.3.0.
 */
function axisCoords(
  spans: Map<string, [number, number]>,
  lo: number,
  hi: number,
  m: Metrics,
): number[] {
  const at = [0]
  for (let i = lo; i < hi; i++) {
    let edges = 0
    for (const [from, to] of spans.values()) {
      if (from <= i !== from <= i + 1 || to >= i !== to >= i + 1) edges++
    }
    at.push(at[at.length - 1]! + m.pitch(edges))
  }
  return at
}

export function layoutArchitectureGrid(
  graph: MermaidGraph,
  /** The caller's page padding; unset, `architecture.padding` (as in mermaid), then 40. */
  pagePadding?: number,
  layout?: ArchitectureInitLayout,
): PositionedGraph {
  const m = metrics(layout)
  const padding = pagePadding ?? layout?.padding ?? DEFAULTS.padding
  const horizontal = graph.direction === 'LR' || graph.direction === 'RL'
  const cell = new Map<string, [number, number]>()
  for (const [id, n] of graph.nodes) {
    const layer = n.gridLayer ?? 0
    const order = n.gridOrder ?? 0
    cell.set(id, horizontal ? [layer, order] : [order, layer])
  }
  separateComponents(graph, cell)

  // The cells each group covers, nested groups included.
  const spanX = new Map<string, [number, number]>()
  const spanY = new Map<string, [number, number]>()
  for (const [id, [cx, cy]] of cell) {
    for (const g of ancestors(graph.subgraphs, id)) {
      const sx = spanX.get(g) ?? [cx, cx]
      const sy = spanY.get(g) ?? [cy, cy]
      spanX.set(g, [Math.min(sx[0], cx), Math.max(sx[1], cx)])
      spanY.set(g, [Math.min(sy[0], cy), Math.max(sy[1], cy)])
    }
  }
  const xs = [...cell.values()].map((c) => c[0])
  const ys = [...cell.values()].map((c) => c[1])
  const x0 = Math.min(...xs)
  const y0 = Math.min(...ys)
  const colX = axisCoords(spanX, x0, Math.max(...xs), m)
  const rowY = axisCoords(spanY, y0, Math.max(...ys), m)

  const nodes: PositionedNode[] = []
  const reach = new Map<string, Box>() // What each node occupies, label included.
  const body = new Map<string, Box>() // What an edge attaches to.
  for (const [id, n] of graph.nodes) {
    const [cx, cy] = cell.get(id)!
    const size = n.shape === 'junction' ? 2 : m.tile
    const x = colX[cx - x0]! - size / 2
    const y = rowY[cy - y0]! - size / 2
    const box = { x, y, width: size, height: size }
    body.set(id, box)
    // A service's label hangs below its tile, wrapped, and may be wider than it.
    const lines = n.icon === undefined ? [] : wrapLabel(n.label, m)
    const textW = Math.max(0, ...lines.map((l) => labelWidth(l, m.fontSize)))
    const spread = Math.max(0, (textW - size) / 2)
    reach.set(
      id,
      n.shape === 'junction'
        ? // Mermaid lays a junction out as a full tile, so groups pad around that.
          {
            x: x + size / 2 - m.tile / 2,
            y: y + size / 2 - m.tile / 2,
            width: m.tile,
            height: m.tile,
          }
        : {
            x: x - spread,
            y,
            width: size + spread * 2,
            // Wrapped lines do not grow the box: Mermaid's padding holds them.
            height: size + m.labelDrop,
          },
    )
    nodes.push({
      id,
      label: n.icon === undefined ? n.label : lines.join('\n'),
      shape: n.icon === undefined ? n.shape : 'rectangle',
      icon: n.icon,
      ...box,
      className: graph.classAssignments.get(id),
      interaction: graph.interactions.get(id),
    })
  }

  // A group is the padded box around its members and its inner groups.
  const groupBox = (sg: MermaidSubgraph): PositionedGroup => {
    const children = sg.children.map(groupBox)
    const pad = (b: Box, by: number): Box => ({
      x: b.x - by,
      y: b.y - by,
      width: b.width + by * 2,
      height: b.height + by * 2,
    })
    let held: Box | undefined
    for (const id of sg.nodeIds) held = union(held, reach.get(id)!)
    let inner: Box | undefined
    for (const c of children) inner = union(inner, c)
    const parts = [
      ...(held ? [pad(held, m.groupPad)] : []),
      ...(inner ? [pad(inner, m.nestedPad)] : []),
    ]
    const box = parts.reduce<Box | undefined>(
      (u, p) => union(u, p),
      undefined,
    ) ?? {
      x: -m.groupPad,
      y: -m.groupPad,
      width: m.groupPad * 2,
      height: m.groupPad * 2,
    }
    body.set(sg.id, box)
    return {
      id: sg.id,
      label: sg.label,
      ...box,
      children,
      ...(sg.icon !== undefined ? { icon: sg.icon } : {}),
      ...(sg.architecture ? { architecture: true } : {}),
    }
  }
  const groups = graph.subgraphs.map(groupBox)

  const edges: PositionedEdge[] = graph.edges.map((e) => {
    const a = body.get(e.source)!
    const b = body.get(e.target)!
    return {
      source: e.source,
      target: e.target,
      label: e.label,
      style: e.style,
      hasArrowStart: e.hasArrowStart,
      hasArrowEnd: e.hasArrowEnd,
      points: route(a, b),
      inlineStyle: { 'stroke-width': EDGE_WIDTH },
    }
  })

  // Move everything to the page padding and size the canvas around it.
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const b of reach.values()) {
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.width)
    maxY = Math.max(maxY, b.y + b.height)
  }
  for (const n of nodes) {
    if (n.icon !== undefined)
      maxY = Math.max(maxY, n.y + n.height + m.labelReach)
  }
  for (const b of body.values()) {
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.width)
    maxY = Math.max(maxY, b.y + b.height)
  }
  const dx = padding - minX
  const dy = padding - minY
  const shiftGroup = (g: PositionedGroup): void => {
    g.x += dx
    g.y += dy
    g.children.forEach(shiftGroup)
  }
  for (const n of nodes) {
    n.x += dx
    n.y += dy
  }
  groups.forEach(shiftGroup)
  for (const e of edges)
    e.points = e.points.map((p) => ({ x: p.x + dx, y: p.y + dy }))

  return {
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
    nodes,
    edges,
    groups,
  }
}

const overlap = (
  alo: number,
  ahi: number,
  blo: number,
  bhi: number,
): number | undefined => {
  const lo = Math.max(alo, blo)
  const hi = Math.min(ahi, bhi)
  return lo < hi || (lo === hi && alo === ahi) ? (lo + hi) / 2 : undefined
}

/**
 * A straight run between the facing sides of two boxes that share a row or
 * column, the way Mermaid draws neighbours on the grid; one elbow otherwise.
 */
function route(a: Box, b: Box): Point[] {
  const row = overlap(a.y, a.y + a.height, b.y, b.y + b.height)
  if (row !== undefined) {
    const [l, r] = a.x <= b.x ? [a, b] : [b, a]
    const run: Point[] = [
      { x: l.x + l.width, y: row },
      { x: r.x, y: row },
    ]
    return l === a ? run : run.reverse()
  }
  const col = overlap(a.x, a.x + a.width, b.x, b.x + b.width)
  if (col !== undefined) {
    const [t, u] = a.y <= b.y ? [a, b] : [b, a]
    const run: Point[] = [
      { x: col, y: t.y + t.height },
      { x: col, y: u.y },
    ]
    return t === a ? run : run.reverse()
  }
  const ay = a.y + a.height / 2
  const bx = b.x + b.width / 2
  return [
    { x: b.x > a.x ? a.x + a.width : a.x, y: ay },
    { x: bx, y: ay },
    { x: bx, y: b.y > a.y ? b.y : b.y + b.height },
  ]
}
