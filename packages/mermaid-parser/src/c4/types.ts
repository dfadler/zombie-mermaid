// ============================================================================
// C4 diagram model (C4Context / C4Container / C4Component / C4Dynamic /
// C4Deployment). Prior art: lukilabs/beautiful-mermaid#34 and #71
// (kristjanakkermann, devx) — see the changeset for attribution.
// ============================================================================

export type C4Variant =
  'context' | 'container' | 'component' | 'dynamic' | 'deployment'

export type C4ElementKind = 'person' | 'system' | 'container' | 'component'

/** Visual variant of an element: plain box, database cylinder, or queue. */
export type C4ElementShape = 'default' | 'db' | 'queue'

export interface C4Element {
  alias: string
  kind: C4ElementKind
  shape: C4ElementShape
  /** `*_Ext` variants: outside the system being described. */
  external: boolean
  label: string
  technology?: string
  description?: string
}

export interface C4Boundary {
  alias: string
  label: string
  /** Boundary type (`Boundary(a, "x", "type")`) or deployment node type. */
  type?: string
  description?: string
  /** Aliases of elements declared directly inside this boundary. */
  elementAliases: string[]
  children: C4Boundary[]
}

export interface C4Relationship {
  from: string
  to: string
  label: string
  technology?: string
  /** `BiRel`: arrowheads at both ends. */
  bidirectional: boolean
  /** `RelIndex(n, ...)` in C4Dynamic diagrams. */
  index?: string
}

export interface C4Diagram {
  variant: C4Variant
  title?: string
  /** Every element in declaration order, wherever it is nested. */
  elements: C4Element[]
  /** Top-level boundaries; elements outside any boundary are not listed. */
  boundaries: C4Boundary[]
  relationships: C4Relationship[]
}
