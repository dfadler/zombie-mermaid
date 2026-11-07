// ============================================================================
// zombie-mermaid — injected layout hints for the ASCII grid (#2645, PR 1)
//
// The grid places nodes and picks edge faces with its own heuristics. A
// provider registered here can hand it ELK's layer, in-layer order and edge-end
// faces instead (docs/decisions/ascii-layout-hints-from-elk.md). No ELK code
// lives in this package: the root entry, the CLI and MCP register a provider
// that wraps the SVG layout engine. Flowchart and state placement read layer,
// order and cross-axis centre (grid.ts), and each edge end's face and its order
// along that face (edge-routing.ts `determinePath`, port-offsets.ts
// `hintedFaces`); without a provider the grid keeps its own placement and faces.
// ============================================================================

import type { MermaidGraph } from '@zombie-mermaid/core'
import type { ErDiagram } from '@zombie-mermaid/mermaid-parser'

/** Side of a node box an edge end attaches to. */
export type AsciiFace = 'T' | 'B' | 'L' | 'R'

export interface AsciiNodeHint {
  /** Flow-axis layer, 0 = the source side, whichever way the flow points. */
  layer: number
  /** Rank inside the layer along the cross axis (SVG orientation: left to right, or top to bottom). */
  order: number
  /** Cross-axis centre in the provider's units, so a consumer can show alignment between layers. */
  cross: number
  /** Cross-axis extent of the node in the same units, so a consumer can turn centres into cell offsets. */
  size: number
}

export interface AsciiEdgeEndHint {
  face: AsciiFace
  /**
   * Rank among the ends on the same face of the same node, along that face
   * (left to right, top to bottom, SVG orientation). Ends the layout puts at one
   * position (an out/in pair) share a rank; the consumer puts the forward end first.
   */
  order: number
}

export interface AsciiEdgeHint {
  /** Index into the parsed graph's edges (ER: relationships). */
  index: number
  from: string
  to: string
  start: AsciiEdgeEndHint
  end: AsciiEdgeEndHint
}

export interface AsciiLayoutHints {
  nodes: Map<string, AsciiNodeHint>
  edges: AsciiEdgeHint[]
}

/**
 * Supplies hints per diagram family. Either method may be absent, and may
 * return `undefined` (for example when no layout engine is available); the
 * grid then keeps its own placement.
 */
export interface AsciiLayoutProvider {
  graph?: (graph: MermaidGraph) => AsciiLayoutHints | undefined
  er?: (diagram: ErDiagram) => AsciiLayoutHints | undefined
}

let provider: AsciiLayoutProvider | undefined

/** Registers the provider, or clears it with `undefined`. */
export function registerAsciiLayout(p: AsciiLayoutProvider | undefined): void {
  provider = p
}

/** The registered provider, if any. */
export function getAsciiLayout(): AsciiLayoutProvider | undefined {
  return provider
}
