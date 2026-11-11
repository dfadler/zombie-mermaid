// ============================================================================
// ASCII renderer — architecture diagram
//
// Lowers the parsed diagram to the flowchart model (`architectureToGraph`)
// and reuses the flowchart grid layout + drawing pipeline.
// ============================================================================

import { splitStatements } from '@zombie-mermaid/core'
import {
  parseArchitecture,
  architectureToGraph,
} from '@zombie-mermaid/mermaid-parser'
import type { ArchitectureDiagram } from '@zombie-mermaid/mermaid-parser'
import type { MermaidGraph, MermaidSubgraph } from '@zombie-mermaid/core'
import type {
  AsciiFace,
  AsciiEdgeEndHint,
  AsciiEdgeHint,
  AsciiLayoutHints,
  AsciiNodeHint,
} from './layout-hints.ts'
import { renderGraphAscii } from './flowchart.ts'
import type { FlowchartAsciiExtras } from './flowchart.ts'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'

/** Icons mermaid@12.3.0 ships art for; any other name draws `?`. */
const KNOWN_ICONS: ReadonlySet<string> = new Set([
  'blank',
  'database',
  'disk',
  'server',
  'cloud',
  'internet',
])

/** Render an `architecture-beta` diagram to ASCII/Unicode text art. */
export function renderArchitectureAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
  extras: FlowchartAsciiExtras = {},
): string {
  const diagram = parseArchitecture(splitStatements(text))
  const graph = architectureToGraph(diagram)
  // Mermaid draws a `?` glyph above the label of a service whose icon it has no
  // art for; the grid has no icon art, so the glyph is a first label line.
  for (const n of graph.nodes.values())
    if (n.icon && !KNOWN_ICONS.has(n.icon)) n.label = `?\n${n.label}`
  // mermaid@12.3.0 has no direction for architecture-beta: the ports alone
  // place every service, so a direction override is ignored (#2912).
  return renderGraphAscii(graph, config, colorMode, theme, {
    ...extras,
    direction: undefined,
    hints: portHints(diagram, graph),
  })
}

function members(sg: MermaidSubgraph): string[] {
  return [...sg.nodeIds, ...sg.children.flatMap(members)]
}

/**
 * Ports can make a group L-shaped (`a:R -- L:b` in one group, `c:B -- T:d` in
 * another): its rectangle then covers a foreign service and the grid draws one
 * box for both. mermaid@12.3.0 keeps groups apart, so a group whose cell box
 * holds a foreign service is stacked on its last layer, and the foreign
 * service steps one layer past it.
 */
function separateGroups(
  subgraphs: MermaidSubgraph[],
  nodes: Map<string, AsciiNodeHint>,
): Set<string> {
  const moved = new Set<string>()
  const all: MermaidSubgraph[] = []
  const ancestors = new Map<MermaidSubgraph, string[]>()
  const owner = new Map<string, string>()
  const walk = (list: MermaidSubgraph[], above: string[]): void =>
    list.forEach((s) => {
      all.push(s)
      ancestors.set(s, above)
      for (const id of s.nodeIds) owner.set(id, s.id)
      walk(s.children, [...above, s.id])
    })
  walk(subgraphs, [])
  // Ponytail: orders of members that share a layer are not re-ranked
  for (const sg of all) {
    const own = new Set(members(sg))
    const hs = [...own].map((id) => nodes.get(id)!).filter(Boolean)
    if (hs.length < 2) continue
    const inBox = (h: AsciiNodeHint): boolean =>
      h.layer >= Math.min(...hs.map((m) => m.layer)) &&
      h.layer <= Math.max(...hs.map((m) => m.layer)) &&
      h.order >= Math.min(...hs.map((m) => m.order)) &&
      h.order <= Math.max(...hs.map((m) => m.order))
    // A service of an enclosing group (a junction in the group's parent) shares
    // its box legitimately; only another group's or a root service collides.
    const foreign = [...nodes].filter(
      ([id, h]) =>
        !own.has(id) &&
        !ancestors.get(sg)!.includes(owner.get(id) ?? '') &&
        inBox(h),
    )
    if (foreign.length === 0) continue
    const last = Math.max(...hs.map((m) => m.layer))
    for (const id of own) if (nodes.get(id)!.layer !== last) moved.add(id)
    for (const h of hs) h.layer = last
    for (const [id, h] of foreign) {
      if (h.layer < last) continue
      h.layer = last + 1
      moved.add(id)
    }
  }
  return moved
}

/** Cross-axis units per grid order step: with `size` 100 the grid's 4-cell slot is `100 + SLOT_GAP`. */
const ORDER_PITCH = 140

/**
 * Layer, order and edge faces straight from the ports (`a:R -- L:b` puts `b`
 * right of `a`, leaving `a` by its right face), so the grid places what
 * mermaid@12.3.0 places instead of rediscovering it from edge direction.
 */
function portHints(
  diagram: ArchitectureDiagram,
  graph: MermaidGraph,
): AsciiLayoutHints {
  const nodes = new Map<string, AsciiNodeHint>()
  for (const n of graph.nodes.values()) {
    nodes.set(n.id, {
      layer: n.gridLayer!,
      order: n.gridOrder!,
      cross: n.gridOrder! * ORDER_PITCH,
      size: 100,
    })
  }
  const moved = separateGroups(graph.subgraphs, nodes)
  const vertical = graph.direction === 'TB'
  const minLayer = Math.min(...[...nodes.values()].map((h) => h.layer))
  for (const h of nodes.values()) h.layer -= minLayer
  const used = new Map<string, number>()
  const end = (id: string, face: AsciiFace): AsciiEdgeEndHint => {
    const key = `${id}\0${face}`
    const order = used.get(key) ?? 0
    used.set(key, order + 1)
    return { face, order }
  }
  const edges = diagram.edges.map((e, index): AsciiEdgeHint => {
    const g = graph.edges[index]!
    // The lowering swaps an edge that runs against the flow; a group end
    // attaches to the enclosing group, so compare against that node.
    const own = [...diagram.services, ...diagram.junctions].find(
      (n) => n.id === e.source,
    )
    const forward = g.source === (e.sourceGroup ? own!.parent : e.source)
    const [a, b] = [g.source, g.target]
    let [aPort, bPort] = forward
      ? [e.sourcePort, e.targetPort]
      : [e.targetPort, e.sourcePort]
    // A moved service no longer sits where its port says: leave and enter by
    // the faces that face the flow instead.
    if (moved.has(e.source) || moved.has(e.target)) {
      const [from, to] = forward ? [e.source, e.target] : [e.target, e.source]
      const d = nodes.get(to)!.layer - nodes.get(from)!.layer
      if (d !== 0) {
        const [lo, hi]: [AsciiFace, AsciiFace] = vertical
          ? ['B', 'T']
          : ['R', 'L']
        ;[aPort, bPort] = d > 0 ? [lo, hi] : [hi, lo]
      }
    }
    return {
      index,
      from: a,
      to: b,
      start: end(a, aPort),
      end: end(b, bPort),
    }
  })
  return { nodes, edges }
}
