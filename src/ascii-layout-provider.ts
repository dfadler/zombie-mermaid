// ============================================================================
// zombie-mermaid — ASCII layout provider backed by the SVG ELK layout (#2645)
//
// Builds the hints `@zombie-mermaid/ascii-renderer` can consume (layer, order,
// edge-end faces) from `layoutFlowchartSync` / `layoutErDiagramSync`, with
// mermaid's pixel node sizes (decision Q5; the cell-size adapter is #2685).
// Registered by the root entry, the CLI and MCP. Flowchart and state placement
// read the layer, order and cross-axis centre (grid.ts).
// ============================================================================

import type { Direction, MermaidGraph } from '@zombie-mermaid/core'
import { registerAsciiLayout } from '@zombie-mermaid/ascii-renderer'
import type {
  AsciiFace,
  AsciiLayoutHints,
  AsciiLayoutProvider,
} from '@zombie-mermaid/ascii-renderer'
import {
  ElkNotRegisteredError,
  layoutErDiagramSync,
  layoutFlowchartSync,
} from '@zombie-mermaid/svg-renderer'

interface Box {
  id: string
  cx: number
  cy: number
  w: number
  h: number
  /** A diamond's ends sit on its slants (`faceOf`). */
  diamond?: boolean
}
interface Path {
  from: string
  to: string
  points: { x: number; y: number }[]
  /**
   * The same edge routed with mermaid's real node sizes. The legacy sizes the
   * hints are laid out with move a lone Z's bend from the gap's middle (where
   * mermaid@12.3.0 puts it) to a quarter of the way; the bend is read from here.
   */
  bendPoints?: { x: number; y: number }[]
}

/** Centres closer than this on the flow axis share a layer (the topology check uses the same 20 px). */
export const LAYER_TOLERANCE = 20

/** Ends within this many px along a face are one position. */
const PORT_TOLERANCE = 0.5
/** A bend within this of 0.5 is "the gap's middle". */
const MIDDLE = 0.05

const faceOf = (
  b: Box,
  p: { x: number; y: number },
  horizontal: boolean,
): AsciiFace => {
  if (b.diamond) {
    // A slant belongs to the flow-axis face once the point is about half way to
    // that vertex; the grid draws a stroke on a slant, not on a side vertex.
    const [df, hf, dc] = horizontal
      ? [p.x - b.cx, b.w / 2, p.y - b.cy]
      : [p.y - b.cy, b.h / 2, p.x - b.cx]
    if (Math.abs(df) / hf >= 0.49)
      return horizontal ? (df < 0 ? 'L' : 'R') : df < 0 ? 'T' : 'B'
    return horizontal ? (dc < 0 ? 'T' : 'B') : dc < 0 ? 'L' : 'R'
  }
  const d = {
    T: Math.abs(p.y - (b.cy - b.h / 2)),
    B: Math.abs(p.y - (b.cy + b.h / 2)),
    L: Math.abs(p.x - (b.cx - b.w / 2)),
    R: Math.abs(p.x - (b.cx + b.w / 2)),
  }
  return (Object.keys(d) as AsciiFace[]).reduce((a, k) => (d[k] < d[a] ? k : a))
}

/**
 * Where a route's longest cross-axis run lies along the flow axis, as a fraction
 * of the way from its first point to its last (`AsciiEdgeHint.bend`), or
 * `undefined` when it has none or starts and ends at one flow position.
 */
export function bendOf(
  points: { x: number; y: number }[],
  horizontal: boolean,
): number | undefined {
  const [m, c] = horizontal ? (['x', 'y'] as const) : (['y', 'x'] as const)
  const from = points[0]![m]
  const span = points[points.length - 1]![m] - from
  if (Math.abs(span) < PORT_TOLERANCE) return undefined
  let at: number | undefined
  let longest = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const len = Math.abs(b[c] - a[c])
    if (Math.abs(b[m] - a[m]) < PORT_TOLERANCE && len > longest) {
      longest = len
      at = a[m]
    }
  }
  return at === undefined
    ? undefined
    : Math.min(1, Math.max(0, (at - from) / span))
}

/**
 * Hints from positioned boxes and edge paths. `flow` is the SVG-side flow
 * direction: layers count from the source side whichever way it points.
 */
export function buildHints(
  boxes: Box[],
  paths: Path[],
  flow: Direction,
  /**
   * Subgraph frames. Only edge ends on them get hints (an edge drawn from or to a
   * subgraph id); they are not nodes, so layers and order ignore them.
   */
  groups: Box[] = [],
): AsciiLayoutHints {
  const horizontal = flow === 'LR' || flow === 'RL'
  const main = (b: Box): number => (horizontal ? b.cx : b.cy)
  const cross = (b: Box): number => (horizontal ? b.cy : b.cx)
  // ELK aligns the leading (or trailing) edge of a layer's nodes, not their
  // centres, so a diamond beside shorter boxes sits further along the flow
  // axis than they do. A node shares a layer when its centre, leading or
  // trailing edge is within `LAYER_TOLERANCE` of the layer's first node.
  const half = (b: Box): number => (horizontal ? b.w : b.h) / 2
  const sorted = [...boxes].sort((a, b) => main(a) - main(b))
  const layerOf = new Map<string, number>()
  let layer = -1
  let first: Box | undefined
  const near = (a: number, b: number): boolean =>
    Math.abs(a - b) <= LAYER_TOLERANCE
  for (const b of sorted) {
    if (
      !first ||
      !(
        near(main(b), main(first)) ||
        near(main(b) - half(b), main(first) - half(first)) ||
        near(main(b) + half(b), main(first) + half(first))
      )
    ) {
      layer++
      first = b
    }
    layerOf.set(b.id, layer)
  }
  const last = layer
  const reversed = flow === 'RL' || flow === 'BT'
  const nodes: AsciiLayoutHints['nodes'] = new Map()
  const rank = new Map<number, number>()
  for (const b of [...boxes].sort((a, b) => cross(a) - cross(b))) {
    const l = layerOf.get(b.id)!
    const order = rank.get(l) ?? 0
    rank.set(l, order + 1)
    nodes.set(b.id, {
      layer: reversed ? last - l : l,
      order,
      cross: cross(b),
      size: horizontal ? b.h : b.w,
    })
  }
  const byId = new Map([...groups, ...boxes].map((b) => [b.id, b]))
  // Order along a face: by the end point's cross-axis coordinate.
  type End = { edge: number; start: boolean; face: AsciiFace; at: number }
  const ends = new Map<string, End[]>()
  const raw = paths.map((p, edge) => {
    const a = byId.get(p.from)
    const b = byId.get(p.to)
    if (!a || !b || p.points.length < 2) return undefined
    const s = p.points[0]!
    const e = p.points[p.points.length - 1]!
    const mk = (
      box: Box,
      pt: { x: number; y: number },
      start: boolean,
    ): End => {
      const face = faceOf(box, pt, horizontal)
      const end = {
        edge,
        start,
        face,
        at: face === 'T' || face === 'B' ? pt.x : pt.y,
      }
      const key = `${box.id}|${face}`
      ends.set(key, [...(ends.get(key) ?? []), end])
      return end
    }
    return { p, s: mk(a, s, true), e: mk(b, e, false) }
  })
  // Ends at one position (an out/in pair ELK gives the same port) share a rank:
  // the consumer breaks that tie, forward end first.
  const orderOf = (box: string, end: End): number => {
    const at = [...ends.get(`${box}|${end.face}`)!].map((x) => x.at)
    return new Set(at.filter((a) => a < end.at - PORT_TOLERANCE)).size
  }
  const edges: AsciiLayoutHints['edges'] = []
  raw.forEach((r, index) => {
    if (!r) return
    const own = bendOf(r.p.points, horizontal)
    const real = r.p.bendPoints && bendOf(r.p.bendPoints, horizontal)
    // Only the gap's middle is taken from the real-size route: elsewhere (a jog
    // at a cluster border, say) it differs from mermaid@12.3.0 as often as the
    // legacy one does, and `System Architecture` F->I got further from it.
    const bend =
      real !== undefined && Math.abs(real - 0.5) < MIDDLE ? real : own
    edges.push({
      index,
      from: r.p.from,
      to: r.p.to,
      start: { face: r.s.face, order: orderOf(r.p.from, r.s) },
      end: { face: r.e.face, order: orderOf(r.p.to, r.e) },
      ...(bend === undefined ? {} : { bend }),
    })
  })
  return { nodes, edges }
}

/** `undefined` (grid placement stays) when elkjs is not registered; other errors propagate. */
const attempt = (f: () => AsciiLayoutHints): AsciiLayoutHints | undefined => {
  try {
    return f()
  } catch (err) {
    if (err instanceof ElkNotRegisteredError) return undefined
    throw err
  }
}

/**
 * A left-to-right flow with a cluster whose edges leave it for one target, three or
 * more of them: mermaid@12.3.0 draws those round the target, and where the target sits
 * against the cluster decides which way each goes. Its own layout (not the legacy
 * node sizes the other hints keep) puts the target there (#2886).
 */
function hasClusterFan(graph: MermaidGraph): boolean {
  if (
    graph.stateDiagram ||
    (graph.direction !== 'LR' && graph.direction !== 'RL')
  ) {
    return false
  }
  const clusters = new Set(graph.subgraphs.map((sg) => sg.id))
  const counts = new Map<string, number>()
  for (const e of graph.edges) {
    if (!clusters.has(e.source)) continue
    const key = `${e.source}\0${e.target}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.values()].some((n) => n >= 3)
}

export const asciiLayoutProvider: AsciiLayoutProvider = {
  graph: (graph) =>
    attempt(() => {
      // mermaid@12.3.0 draws flowchart node labels at 16px and boxes edge labels at 16px.
      const mermaidSizes = graph.stateDiagram
        ? {}
        : { fontSizes: { nodeLabel: 16 }, layoutEdgeLabelFontSize: 16 }
      const real = layoutFlowchartSync(graph, {
        legacyNodeSizes: false,
        ...mermaidSizes,
      })
      const pos = hasClusterFan(graph)
        ? real
        : layoutFlowchartSync(graph, { legacyNodeSizes: true })
      return buildHints(
        pos.nodes.map((n) => ({
          id: n.id,
          cx: n.x + n.width / 2,
          cy: n.y + n.height / 2,
          w: n.width,
          h: n.height,
          diamond: n.shape === 'diamond',
        })),
        pos.edges.map((e, i) => ({
          from: e.source,
          to: e.target,
          points: e.points,
          // Same graph, same edge order in both layouts.
          bendPoints: real.edges[i]?.points,
        })),
        graph.direction,
        pos.groups.map((g) => ({
          id: g.id,
          cx: g.x + g.width / 2,
          cy: g.y + g.height / 2,
          w: g.width,
          h: g.height,
        })),
      )
    }),
  er: (diagram) =>
    attempt(() => {
      const pos = layoutErDiagramSync(diagram)
      return buildHints(
        pos.entities.map((n) => ({
          id: n.id,
          cx: n.x + n.width / 2,
          cy: n.y + n.height / 2,
          w: n.width,
          h: n.height,
        })),
        pos.relationships.map((r) => ({
          from: r.entity1,
          to: r.entity2,
          points: r.points,
        })),
        diagram.direction ?? 'TD',
      )
    }),
}

/** Registers the ELK-backed provider with the ASCII renderer. Idempotent. */
export function registerAsciiLayoutFromElk(): void {
  registerAsciiLayout(asciiLayoutProvider)
}
