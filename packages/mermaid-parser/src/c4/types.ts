import type { Direction, Point } from '@zombie-mermaid/core'

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

/**
 * Layout placement hint carried by `Rel_U`/`Rel_D`/`Rel_L`/`Rel_R` (and their
 * long-form aliases): where `to` should sit relative to `from`. Plain `Rel`,
 * `BiRel`, `RelIndex` and `Rel_Back` carry none.
 */
export type C4LayoutHint = 'up' | 'down' | 'left' | 'right'

export interface C4Relationship {
  from: string
  to: string
  label: string
  technology?: string
  /** `BiRel`: arrowheads at both ends. */
  bidirectional: boolean
  /**
   * `Rel_Back`: the arrowhead points at `from` instead of `to`. `from`/`to`
   * stay as declared, so layout and placement hints still follow them.
   */
  reversed?: boolean
  /** `RelIndex(n, ...)` in C4Dynamic diagrams. */
  index?: string
  /** Placement hint from a directional `Rel_*` macro; see `C4LayoutHint`. */
  layout?: C4LayoutHint
}

export interface C4Diagram {
  variant: C4Variant
  /**
   * Top-level layout direction. Never set by the parser (C4 sources have no
   * direction statement); only `RenderOptions.direction` sets it, via
   * `withDirectionOverride`. Unset lays out top-to-bottom.
   */
  direction?: Direction
  title?: string
  /** Every element in declaration order, wherever it is nested. */
  elements: C4Element[]
  /** Top-level boundaries; elements outside any boundary are not listed. */
  boundaries: C4Boundary[]
  relationships: C4Relationship[]
}

// ----------------------------------------------------------------------------
// Positioned model (SVG layout output)
// ----------------------------------------------------------------------------

export interface PositionedC4Element extends C4Element {
  x: number
  y: number
  width: number
  height: number
  /** Name wrapped to the box width, one entry per line. */
  nameLines: string[]
  /** Description wrapped to the box width, one entry per line. */
  descriptionLines: string[]
}

export interface PositionedC4Boundary {
  alias: string
  label: string
  type?: string
  description?: string
  x: number
  y: number
  width: number
  height: number
  /** Nesting depth, 0 for a top-level boundary. */
  depth: number
}

export interface PositionedC4Relationship extends C4Relationship {
  points: Point[]
  /** Centre of the label block, when the relationship has label text. */
  labelPosition?: Point
}

export interface PositionedC4Diagram {
  variant: C4Variant
  title?: string
  width: number
  height: number
  /** Where the title baseline sits (centre x, y), when there is a title. */
  titlePosition?: Point
  elements: PositionedC4Element[]
  /** Outer boundaries first, so inner ones paint on top. */
  boundaries: PositionedC4Boundary[]
  relationships: PositionedC4Relationship[]
}
