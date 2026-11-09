// ============================================================================
// Sankey types
//
// The parsed model of a Mermaid `sankey-beta` diagram, plus the positioned
// model the SVG renderer draws (`PositionedSankey`, produced by `layoutSankey`
// in `@zombie-mermaid/svg-renderer`). The ASCII renderer works from the parsed
// `Sankey` directly.
// ============================================================================

import type { SankeyInitConfig } from '@zombie-mermaid/core'

/** One `source,target,value` row. */
export interface SankeyLink {
  source: string
  target: string
  value: number
}

/** A parsed Mermaid sankey diagram. */
export interface Sankey {
  /** Node ids in order of first appearance (a source before a target on the same row). */
  nodes: string[]
  /** Rows in source order; a repeated pair stays two links, as in Mermaid. */
  links: SankeyLink[]
  /** `%%{init: {"sankey": {...}}}%%` keys mermaid reads. */
  config?: SankeyInitConfig
}

/** A node bar with its label. */
export interface PositionedSankeyNode {
  id: string
  /** Index in the parsed `nodes`; picks the colour. */
  index: number
  x0: number
  y0: number
  x1: number
  y1: number
  /** Larger of the node's incoming and outgoing totals. */
  value: number
  /** Column the node sits in. */
  layer: number
  /** CSS colour from `nodeColors`, when the config sets one for this id. */
  color?: string
  label: {
    /** The id, then the value after a space when `showValues` (Mermaid writes a line break, which SVG text draws as a space). */
    text: string
    x: number
    /** Text baseline (the vertical centre of the node). */
    y: number
    anchor: 'start' | 'end'
  }
}

/** A ribbon from a source node to a target node. */
export interface PositionedSankeyLink {
  /** Indexes into `nodes`. */
  source: number
  target: number
  value: number
  /** Stroke width of the ribbon. */
  width: number
  /** The cubic path from the source's right edge to the target's left edge. */
  x0: number
  y0: number
  x1: number
  y1: number
}

/** A sankey ready to draw; all coordinates are relative to the viewBox origin. */
export interface PositionedSankey {
  width: number
  height: number
  nodes: PositionedSankeyNode[]
  links: PositionedSankeyLink[]
  /** Resolved config (defaults applied). */
  options: {
    linkColor: string
    labelStyle: 'legacy' | 'outlined'
    showValues: boolean
  }
}
