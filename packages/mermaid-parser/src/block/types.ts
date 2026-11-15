// ============================================================================
// Block diagram types
//
// The parsed model of a Mermaid `block` / `block-beta` diagram, plus the
// positioned model the SVG renderer draws (`PositionedBlockDiagram`, produced by
// `layoutBlock` in `@zombie-mermaid/svg-renderer`). The ASCII renderer works
// from the parsed `BlockDiagram` directly.
// ============================================================================

/** Shapes supported so far: `id`, `id["x"]` (square) and `id("x")` (round, 5px corners). */
export type BlockShape = 'square' | 'round'

/** A leaf block, a `space` cell, or a `block ... end` group (`composite`). */
export interface BlockNode {
  /** Mermaid's block id; anonymous groups and spaces get `block-N` / `space-N`. */
  id: string
  type: 'node' | 'space' | 'composite'
  /** The label as written (`<br>` breaks kept); `''` for spaces and groups. */
  label: string
  shape: BlockShape
  /** `a:2`, `block:id:2`: how many columns the block spans (1 when absent). */
  widthInColumns: number
  /** A group's `columns N` (`-1`: no limit, one row). Absent on leaves. */
  columns?: number
  /** A group's blocks, in order. */
  children: BlockNode[]
  /** `class a name`: the class names, in the order applied. */
  classes: string[]
  /** `style a fill:#f9f,stroke:#333`: the `property:value` items, trimmed. */
  styles: string[]
}

/** The end of an edge: Mermaid's `arrow_point` / `arrow_cross` / `arrow_circle`, `''` for a plain end. */
export type BlockArrow = '' | 'arrow_point' | 'arrow_cross' | 'arrow_circle'

/** A link between two blocks: `A --> B`, `A -- "text" ==> B`, `A -.- B`. */
export interface BlockEdge {
  /** Mermaid's `<n>-<start>-<end>`, `n` counting links between the same two ids. */
  id: string
  start: string
  end: string
  label: string
  thickness: 'normal' | 'thick'
  pattern: 'solid' | 'dotted'
  /** `arrow_open` (no marker) when the start has none. */
  arrowTypeStart: BlockArrow | 'arrow_open'
  arrowTypeEnd: BlockArrow
}

/** A parsed Mermaid block diagram. */
export interface BlockDiagram {
  /** The top level: Mermaid's invisible `root` block. */
  root: BlockNode
  /** Links, in the order they are written. */
  edges: BlockEdge[]
  /** `classDef name fill:#f9f,...`: each class's `property:value` items. */
  classDefs: Record<string, string[]>
  /** Space between cells and inside each block: `block.padding` from front matter or `%%{init}%%` (default 8). */
  padding: number
}

/** A line of a block's label. */
export interface PositionedBlockText {
  lines: string[]
  /** Width of the widest line in px (Trebuchet MS, 16px). */
  width: number
}

/** A block with its place, ready to draw. `x`, `y` are the centre. */
export interface PositionedBlockNode {
  id: string
  type: 'node' | 'composite'
  shape: BlockShape
  x: number
  y: number
  width: number
  height: number
  text: PositionedBlockText
  /** The block's classes (`class a name`), on the node group. */
  classes: string[]
  /** Style properties after merging `classDef` items (in class order) and `style` items, `color` included. */
  css: [string, string][]
}

/** An edge with its path points and label place (Mermaid's space). */
export interface PositionedBlockEdge {
  id: string
  /** Start, midpoint, end after clipping to the blocks, before marker offsets. */
  points: { x: number; y: number }[]
  /** The SVG path `d`, a basis curve through `points` with Mermaid's marker offsets. */
  path: string
  label: string
  /** Centre of the label, when there is one. */
  labelX: number
  labelY: number
  labelWidth: number
  thickness: 'normal' | 'thick'
  pattern: 'solid' | 'dotted'
  arrowTypeStart: BlockEdge['arrowTypeStart']
  arrowTypeEnd: BlockArrow
}

/** A laid-out block diagram. */
export interface PositionedBlockDiagram {
  /** Every drawn block, parents before children (spaces are not drawn). */
  nodes: PositionedBlockNode[]
  edges: PositionedBlockEdge[]
  /** The SVG viewBox: the blocks' bounds plus 5px each side, as Mermaid does. */
  viewBox: { x: number; y: number; width: number; height: number }
}
