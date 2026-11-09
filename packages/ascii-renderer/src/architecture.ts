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
import type { MermaidGraph } from '@zombie-mermaid/core'
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
  // mermaid@12.3.0 has no direction for architecture-beta: the ports alone
  // place every service, so a direction override is ignored (#2912).
  return renderGraphAscii(graph, config, colorMode, theme, {
    ...extras,
    direction: undefined,
    hints: portHints(diagram, graph),
  })
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
    const [a, aPort, b, bPort] = forward
      ? [g.source, e.sourcePort, g.target, e.targetPort]
      : [g.source, e.targetPort, g.target, e.sourcePort]
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
