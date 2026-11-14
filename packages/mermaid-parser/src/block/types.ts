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
}

/** A parsed Mermaid block diagram. */
export interface BlockDiagram {
  /** The top level: Mermaid's invisible `root` block. */
  root: BlockNode
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
}

/** A laid-out block diagram. */
export interface PositionedBlockDiagram {
  /** Every drawn block, parents before children (spaces are not drawn). */
  nodes: PositionedBlockNode[]
  /** The SVG viewBox: the blocks' bounds plus 5px each side, as Mermaid does. */
  viewBox: { x: number; y: number; width: number; height: number }
}
