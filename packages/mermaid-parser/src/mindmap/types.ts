// ============================================================================
// Mindmap types
//
// The parsed (logical) model of a Mermaid `mindmap`, plus the positioned model
// the SVG renderer draws (`PositionedMindmap`, produced by `layoutMindmap` in
// `@zombie-mermaid/svg-renderer`). The ASCII renderer works from the parsed
// `Mindmap` directly, like pie and quadrant do.
// ============================================================================

/**
 * The node shapes Mermaid's grammar has, by delimiter:
 * `default` (bare text), `rect` `[x]`, `rounded` `(x)`, `circle` `((x))`,
 * `cloud` `)x(`, `bang` `))x((` and `hexagon` `{{x}}`.
 */
export type MindmapShape =
  | 'default'
  | 'rect'
  | 'rounded'
  | 'circle'
  | 'cloud'
  | 'bang'
  | 'hexagon'

/** One node of the tree. */
export interface MindmapNode {
  /** Source order, the root being 0 (Mermaid's `node_<id>`). */
  id: number
  /** The label as written, entities decoded. May hold `\n` and `<br>` breaks. */
  text: string
  shape: MindmapShape
  /**
   * Indentation relative to the root's, in characters (Mermaid's `level`, not
   * the depth): the root is 0. Mermaid's connector thickness follows it.
   */
  level: number
  /**
   * `::icon(fa fa-book)` classes. Mermaid 12.3.0 records but never draws them
   * (no icon font is loaded), so neither renderer draws one.
   */
  icon?: string
  /** `:::urgent large`, the CSS classes the node asks for. */
  className?: string
  children: MindmapNode[]
}

/** A parsed Mermaid mindmap. */
export interface Mindmap {
  root: MindmapNode
}

/** One run of label text with its Markdown emphasis. */
export interface MindmapTextRun {
  text: string
  bold: boolean
  italic: boolean
}

/** A node placed by the layout. Coordinates are the centre, in SVG user units. */
export interface PositionedMindmapNode {
  node: MindmapNode
  /** Colour section: `undefined` for the root, else the top-level branch index. */
  section: number | undefined
  x: number
  y: number
  /** Bounding box of the drawn shape, its top-left relative to (x, y). */
  width: number
  height: number
  boxX: number
  boxY: number
  /** Label lines, each a list of styled runs. */
  lines: MindmapTextRun[][]
  /** Label box, centred on the node. */
  labelWidth: number
  labelHeight: number
  /** SVG path data (`d`) for path-like shapes, relative to the node centre. */
  path?: string
  /** Polygon `points` for the hexagon, relative to the node centre. */
  points?: string
  /** Circle radius. */
  radius?: number
  /** Rectangle (rect and rounded shapes), centred on the node. */
  rect?: { width: number; height: number; radius: number }
  /** The default shape's underline. */
  underline?: boolean
}

/** A parent-child connector, as a smoothed path. */
export interface PositionedMindmapEdge {
  from: number
  to: number
  /** Colour section of the child. */
  section: number | undefined
  /** The parent's `level` plus one (Mermaid's `edge-depth-N`). */
  depth: number
  path: string
}

/** A mindmap laid out for the SVG renderer. */
export interface PositionedMindmap {
  width: number
  height: number
  /** `viewBox` origin; Mermaid's frame starts at the padded top-left. */
  originX: number
  originY: number
  nodes: PositionedMindmapNode[]
  edges: PositionedMindmapEdge[]
}
