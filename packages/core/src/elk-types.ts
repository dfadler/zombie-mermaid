// ============================================================================
// Structural ELK graph types, owned here so the published `.d.ts` files never
// import from `elkjs` (an optional peer dependency since #1370).
//
// These are structurally identical to the matching interfaces in elkjs's own
// `elk-api.d.ts`, so a real `ElkNode` from elkjs is assignable to ours and
// vice versa. Only the subset zombie-mermaid's public API touches is declared.
// ============================================================================

export interface LayoutOptions {
  [key: string]: string
}

export interface ElkPoint {
  x: number
  y: number
}

export interface ElkGraphElement {
  id?: string
  labels?: ElkLabel[]
  layoutOptions?: LayoutOptions
}

export interface ElkShape extends ElkGraphElement {
  x?: number
  y?: number
  width?: number
  height?: number
}

export interface ElkNode extends ElkShape {
  id: string
  children?: ElkNode[]
  ports?: ElkPort[]
  edges?: ElkExtendedEdge[]
}

export interface ElkPort extends ElkShape {
  id: string
}

export interface ElkLabel extends ElkShape {
  text?: string
}

export interface ElkEdgeSection extends ElkGraphElement {
  id: string
  startPoint: ElkPoint
  endPoint: ElkPoint
  bendPoints?: ElkPoint[]
  incomingShape?: string
  outgoingShape?: string
  incomingSections?: string[]
  outgoingSections?: string[]
}

export interface ElkExtendedEdge extends ElkGraphElement {
  id: string
  container?: string
  junctionPoints?: ElkPoint[]
  sources: string[]
  targets: string[]
  sections?: ElkEdgeSection[]
}

/**
 * An `ELK` class from `elkjs/lib/elk.bundled.js` or `elkjs/lib/main.js`.
 * Pass it to `registerElk()`.
 */
export interface ElkConstructor {
  new (args?: { defaultLayoutOptions?: LayoutOptions }): unknown
}
