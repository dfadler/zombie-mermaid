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

/** Centre-to-centre distance between neighbouring cells (a gap of 120 between tiles). */
const PITCH = 200
/**
 * Space a group leaves between its border and the services it holds, measured
 * on mermaid@12.3.0 (a lone service in a group: 165 x 182 around an 80px tile).
 * The bottom also holds the label (`LABEL_DROP`).
 */
const GROUP_PADDING = 42.5
/** Space an outer group leaves around the groups it holds (mermaid@12.3.0: 248 around 165, 331 around 248). */
const NESTED_PADDING = 41.5
/** A service label hangs this far below its tile (182 - 42.5 - 80 - 42.5 = 17). */
const LABEL_DROP = 17
/** Mermaid wraps a service label at 1.5 tiles (`iconSize * 1.5`). */
const LABEL_WRAP = TILE * 1.5
/** Mermaid draws an architecture edge 3px wide (`archEdgeWidth`). */
const EDGE_WIDTH = '3'

const labelWidth = (text: string): number =>
  measureTextWidth(text, FONT_SIZES.nodeLabel, FONT_WEIGHTS.nodeLabel)

/** Break a label into lines no wider than `LABEL_WRAP`; a longer single word stays whole. */
function wrapLabel(label: string): string[] {
  const lines: string[] = []
  for (const para of label.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (line && labelWidth(next) > LABEL_WRAP) {
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
 * Coordinate of each index on one axis: `PITCH` apart, plus
 * `NESTED_PADDING` for every group border between two neighbours beyond the
 * first. Mermaid's fcose keeps 120px between the tiles of neighbours and 75px
 * (`nodeSeparation`) between a border and the next box, so one border (a service
 * next to a group) costs nothing, two (group beside group) +43 and three +80,
 * measured on mermaid@12.3.0.
 */
function axisCoords(
  spans: Map<string, [number, number]>,
  lo: number,
  hi: number,
): number[] {
  const at = [0]
  for (let i = lo; i < hi; i++) {
    let edges = 0
    for (const [from, to] of spans.values()) {
      if (from <= i !== from <= i + 1 || to >= i !== to >= i + 1) edges++
    }
    at.push(
      at[at.length - 1]! + PITCH + NESTED_PADDING * Math.max(0, edges - 1),
    )
  }
  return at
}

export function layoutArchitectureGrid(
  graph: MermaidGraph,
  padding: number = DEFAULTS.padding,
): PositionedGraph {
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
  const colX = axisCoords(spanX, x0, Math.max(...xs))
  const rowY = axisCoords(spanY, y0, Math.max(...ys))

  const nodes: PositionedNode[] = []
  const reach = new Map<string, Box>() // What each node occupies, label included.
  const body = new Map<string, Box>() // What an edge attaches to.
  for (const [id, n] of graph.nodes) {
    const [cx, cy] = cell.get(id)!
    const size = n.shape === 'junction' ? 2 : TILE
    const x = colX[cx - x0]! - size / 2
    const y = rowY[cy - y0]! - size / 2
    const box = { x, y, width: size, height: size }
    body.set(id, box)
    // A service's label hangs below its tile, wrapped, and may be wider than it.
    const lines = n.icon === undefined ? [] : wrapLabel(n.label)
    const textW = Math.max(0, ...lines.map(labelWidth))
    const spread = Math.max(0, (textW - size) / 2)
    reach.set(
      id,
      n.shape === 'junction'
        ? // Mermaid lays a junction out as a full tile, so groups pad around that.
          {
            x: x + size / 2 - TILE / 2,
            y: y + size / 2 - TILE / 2,
            width: TILE,
            height: TILE,
          }
        : n.icon === undefined
          ? box
          : {
              x: x - spread,
              y,
              width: size + spread * 2,
              // Wrapped lines do not grow the box: Mermaid's padding holds them.
              height: size + LABEL_DROP,
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
      ...(held ? [pad(held, GROUP_PADDING)] : []),
      ...(inner ? [pad(inner, NESTED_PADDING)] : []),
    ]
    const box = parts.reduce<Box | undefined>(
      (u, p) => union(u, p),
      undefined,
    ) ?? {
      x: -GROUP_PADDING,
      y: -GROUP_PADDING,
      width: GROUP_PADDING * 2,
      height: GROUP_PADDING * 2,
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
