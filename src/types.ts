// ============================================================================
// Parsed graph — logical structure extracted from Mermaid text
// ============================================================================

import type { InitConfig, CurveStyle } from './init-directive.ts'

export interface MermaidGraph {
  direction: Direction
  nodes: Map<string, MermaidNode>
  edges: MermaidEdge[]
  subgraphs: MermaidSubgraph[]
  classDefs: Map<string, Record<string, string>>
  /** Maps node IDs to their class names (from `class X className` or `:::className` shorthand) */
  classAssignments: Map<string, string>
  /** Maps node IDs to inline styles (from `style X fill:#f00,stroke:#333`) */
  nodeStyles: Map<string, Record<string, string>>
  /** Maps edge indices (or 'default') to inline styles from `linkStyle` directives */
  linkStyles: Map<number | 'default', Record<string, string>>
  /** Maps node IDs to interactions declared by `click` statements */
  interactions: Map<string, NodeInteraction>
  /** Configuration the diagram set for itself via `%%{init: ...}%%` */
  initConfig?: InitConfig
}

export type Direction = 'TD' | 'TB' | 'LR' | 'BT' | 'RL'

export interface MermaidNode {
  id: string
  label: string
  shape: NodeShape
}

export type NodeShape =
  | 'rectangle'
  | 'rounded'
  | 'diamond'
  | 'stadium'
  | 'circle'
  // Batch 1 additions
  | 'subroutine' // [[text]]  — double-bordered rectangle
  | 'doublecircle' // (((text))) — concentric circles
  | 'hexagon' // {{text}}  — six-sided polygon
  // Batch 2 additions
  | 'cylinder' // [(text)]  — database cylinder
  | 'asymmetric' // >text]    — flag/banner shape
  | 'trapezoid' // [/text\]  — wider bottom
  | 'trapezoid-alt' // [\text/]  — wider top
  // Parallelogram — note the delimiters mirror rather than oppose, which is
  // what distinguishes these from the trapezoids above: [/…/] not [/…\].
  | 'parallelogram' // [/text/]  — leans right
  | 'parallelogram-alt' // [\text\]  — leans left
  // Batch 3 state diagram pseudostates
  | 'state-start' // filled circle (start pseudostate)
  | 'state-end' // bullseye circle (end pseudostate)
  // ---------------------------------------------------------------------
  // Expanded-syntax shapes — reachable via `A@{ shape: ... }` only; the
  // classic bracket syntax has no spelling for them. See
  // src/expanded-shapes.ts for the full name→shape alias table.
  // ---------------------------------------------------------------------
  | 'document' // wavy-bottomed page
  | 'stacked-document' // document with offset copies behind it
  | 'stacked-process' // rectangle with offset copies behind it
  | 'card' // rectangle with a notched top-left corner
  | 'lined-process' // rectangle with a vertical rule inset from the left
  | 'divided-process' // rectangle split by a horizontal rule
  | 'window-pane' // rectangle quartered by a cross
  | 'triangle' // apex up
  | 'flipped-triangle' // apex down
  | 'filled-circle' // solid dot — junction
  | 'crossed-circle' // circle with an X through it — summary
  | 'fork-join' // solid bar
  | 'notched-pentagon' // rectangle with clipped top corners — loop limit
  | 'sloped-rectangle' // sloped top edge — manual input
  | 'flag' // wavy top and bottom — paper tape
  | 'bow-tie-rectangle' // concave left and right edges — stored data
  | 'half-rounded-rectangle' // one rounded end — delay
  | 'brace' // left brace only
  | 'brace-right' // right brace only
  | 'braces' // braces on both sides
  | 'bolt' // lightning bolt — communication link
  | 'text' // label with no outline
  | 'anchor' // invisible point

export interface MermaidEdge {
  source: string
  target: string
  label?: string
  style: EdgeStyle
  /** Whether to render an arrowhead at the start (source end) of the edge */
  hasArrowStart: boolean
  /** Whether to render an arrowhead at the end (target end) of the edge */
  hasArrowEnd: boolean
  /** Edge id from `A e1@--> B` (Mermaid v11.10.0+), for `e1@{ ... }` and CSS targeting */
  id?: string
  /** Set by `e1@{ animate: true }` — renders as a marching-ants dash */
  animate?: boolean
}

/**
 * An interaction attached to a node by a `click` statement.
 *
 * This renderer emits static SVG and never executes diagram-supplied script,
 * so a `call`/callback binding is recorded but not invoked — see
 * docs/diagrams.md. An `href` becomes a real SVG link.
 */
export interface NodeInteraction {
  /** `click A "https://..."` — rendered as an <a> wrapper */
  href?: string
  /** Link target, e.g. `_blank` */
  target?: string
  /** Tooltip text — rendered as a <title> child */
  tooltip?: string
  /** `click A call fn()` — recorded as a data attribute, never executed */
  callback?: string
}

export type EdgeStyle =
  | 'solid'
  | 'dotted'
  | 'thick'
  /** `A ~~~ B` — participates in layout but draws no line or arrowhead. */
  | 'invisible'

export interface MermaidSubgraph {
  id: string
  label: string
  nodeIds: string[]
  children: MermaidSubgraph[]
  /** Optional direction override for this subgraph's internal layout */
  direction?: Direction
}

// ============================================================================
// Positioned graph — after ELK layout, ready for SVG rendering
// ============================================================================

export interface PositionedGraph {
  width: number
  height: number
  nodes: PositionedNode[]
  edges: PositionedEdge[]
  groups: PositionedGroup[]
}

export interface PositionedNode {
  id: string
  label: string
  shape: NodeShape
  x: number
  y: number
  width: number
  height: number
  /** Inline styles resolved from classDef + explicit `style` statements — override theme defaults */
  inlineStyle?: Record<string, string>
  /** Custom class name assigned via `class A className` or `:::className` shorthand — emitted onto the rendered element's `class` attribute so external CSS can target it */
  className?: string
  /** Interaction from a `click` statement — an href wraps the node in an <a> */
  interaction?: NodeInteraction
}

export interface PositionedEdge {
  source: string
  target: string
  label?: string
  style: EdgeStyle
  hasArrowStart: boolean
  hasArrowEnd: boolean
  /** Full path including bends — array of {x, y} points */
  points: Point[]
  /** Layout-computed label center position (avoids label-label collisions) */
  labelPosition?: Point
  /** Inline styles resolved from `linkStyle` directives — override theme defaults */
  inlineStyle?: Record<string, string>
  /** Edge id from `A e1@--> B`, emitted as data-id for CSS targeting */
  id?: string
  /** Set by `e1@{ animate: true }` — renders as a marching-ants dash */
  animate?: boolean
}

export interface Point {
  x: number
  y: number
}

export interface PositionedGroup {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  children: PositionedGroup[]
}

// ============================================================================
// Render options — user-facing configuration
//
// Color theming uses CSS custom properties: --bg and --fg are required,
// optional enrichment variables (--line, --accent, --muted, --surface,
// --border) add richer color from Shiki themes or custom palettes.
// See src/theme.ts for the full variable system.
// ============================================================================

export interface RenderOptions {
  /** Background color → CSS variable --bg. Default: '#FFFFFF' */
  bg?: string
  /** Foreground / primary text color → CSS variable --fg. Default: '#27272A' */
  fg?: string

  // -- Optional enrichment colors (fall back to color-mix from bg/fg) --

  /** Edge/connector color → CSS variable --line */
  line?: string
  /** Arrow heads, highlights → CSS variable --accent */
  accent?: string
  /** Secondary text, edge labels → CSS variable --muted */
  muted?: string
  /** Node/box fill tint → CSS variable --surface */
  surface?: string
  /** Node/group stroke color → CSS variable --border */
  border?: string

  /** Font family for all text. Default: 'Inter' */
  font?: string
  /** Canvas padding in px. Default: 40. Flowchart/state diagrams only — class/ER diagrams use fixed internal padding. */
  padding?: number
  /** Horizontal spacing between sibling nodes. Default: 28. Flowchart/state diagrams only — class/ER diagrams use fixed internal spacing. */
  nodeSpacing?: number
  /** Vertical spacing between layers. Default: 48. Flowchart/state diagrams only — class/ER diagrams use fixed internal spacing. */
  layerSpacing?: number
  /** Currently unused — accepted for forward compatibility but not read anywhere. */
  componentSpacing?: number
  /** Whether to bundle overlapping fan-out/fan-in edge paths into shared trunks to reduce visual clutter. Default: true */
  mergeEdges?: boolean
  /** Render with transparent background (no background style on SVG). Default: false */
  transparent?: boolean
  /** Enable hover tooltips on chart data points (xychart only). Default: false */
  interactive?: boolean
  /** Stamp the original diagram source onto the root `<svg>` as a `data-src` attribute (HTML-escaped). Default: false */
  embedSource?: boolean

  /**
   * Edge path interpolation for flowcharts and state diagrams.
   * Default: 'linear'. A diagram's own
   * `%%{init: {"flowchart": {"curve": ...}}}%%` supplies this when the caller
   * does not; an explicit value here always wins.
   */
  curve?: CurveStyle

  /**
   * Font size overrides (px). Fields left unspecified fall back to their
   * default. Applies to all diagram types (flowchart, sequence, class, ER).
   */
  fontSizes?: {
    /** Node label text. Default: 13 */
    nodeLabel?: number
    /** Edge label text. Default: 11 */
    edgeLabel?: number
    /** Subgraph header text. Default: 12 */
    groupHeader?: number
  }

  /**
   * Sequence-diagram layout overrides (px). Fields left unspecified fall
   * back to their default. Sequence diagrams only.
   */
  sequence?: {
    /** Vertical space per message row. Default: 40 */
    messageRowHeight?: number
    /** Vertical space between actor boxes and the first message. Default: 20 */
    headerGap?: number
    /** Actor box height. Default: 40 */
    actorHeight?: number
    /** Gap between a message arrow and a note positioned directly after it. Default: 8 */
    noteOffsetAfterMessage?: number
    /** Gap between consecutively stacked notes. Default: 4 */
    noteStackGap?: number
  }
}
