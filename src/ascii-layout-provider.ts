// ============================================================================
// zombie-mermaid — ASCII layout provider backed by the SVG ELK layout (#2645)
//
// Builds the hints `@zombie-mermaid/ascii-renderer` can consume (layer, order,
// edge-end faces) from `layoutFlowchartSync` / `layoutErDiagramSync`, with
// mermaid's pixel node sizes (decision Q5; the cell-size adapter is #2685).
// Registered by the root entry, the CLI and MCP. The grid does not read the
// hints yet, so registering changes no output.
// ============================================================================

import type { Direction } from '@zombie-mermaid/core'
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
}
interface Path {
  from: string
  to: string
  points: { x: number; y: number }[]
}

/** Centres closer than this on the flow axis share a layer (the topology check uses the same 20 px). */
export const LAYER_TOLERANCE = 20

const faceOf = (b: Box, p: { x: number; y: number }): AsciiFace => {
  const d = {
    T: Math.abs(p.y - (b.cy - b.h / 2)),
    B: Math.abs(p.y - (b.cy + b.h / 2)),
    L: Math.abs(p.x - (b.cx - b.w / 2)),
    R: Math.abs(p.x - (b.cx + b.w / 2)),
  }
  return (Object.keys(d) as AsciiFace[]).reduce((a, k) => (d[k] < d[a] ? k : a))
}

/**
 * Hints from positioned boxes and edge paths. `flow` is the SVG-side flow
 * direction: layers count from the source side whichever way it points.
 */
export function buildHints(
  boxes: Box[],
  paths: Path[],
  flow: Direction,
): AsciiLayoutHints {
  const horizontal = flow === 'LR' || flow === 'RL'
  const main = (b: Box): number => (horizontal ? b.cx : b.cy)
  const cross = (b: Box): number => (horizontal ? b.cy : b.cx)
  const sorted = [...boxes].sort((a, b) => main(a) - main(b))
  const layerOf = new Map<string, number>()
  let layer = -1
  let prev = -Infinity
  for (const b of sorted) {
    if (main(b) - prev > LAYER_TOLERANCE) layer++
    prev = main(b)
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
    })
  }
  const byId = new Map(boxes.map((b) => [b.id, b]))
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
      const face = faceOf(box, pt)
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
  const orderOf = (box: string, end: End): number =>
    [...ends.get(`${box}|${end.face}`)!]
      .sort((x, y) => x.at - y.at || x.edge - y.edge)
      .indexOf(end)
  const edges: AsciiLayoutHints['edges'] = []
  raw.forEach((r, index) => {
    if (!r) return
    edges.push({
      index,
      from: r.p.from,
      to: r.p.to,
      start: { face: r.s.face, order: orderOf(r.p.from, r.s) },
      end: { face: r.e.face, order: orderOf(r.p.to, r.e) },
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

export const asciiLayoutProvider: AsciiLayoutProvider = {
  graph: (graph) =>
    attempt(() => {
      const pos = layoutFlowchartSync(graph)
      return buildHints(
        pos.nodes.map((n) => ({
          id: n.id,
          cx: n.x + n.width / 2,
          cy: n.y + n.height / 2,
          w: n.width,
          h: n.height,
        })),
        pos.edges.map((e) => ({
          from: e.source,
          to: e.target,
          points: e.points,
        })),
        graph.direction,
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
