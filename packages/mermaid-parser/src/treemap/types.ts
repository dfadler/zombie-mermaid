// ============================================================================
// Treemap types
//
// The parsed model of a Mermaid `treemap` / `treemap-beta` diagram, plus the
// positioned model the SVG renderer draws (`PositionedTreemap`, produced by
// `layoutTreemap` in `@zombie-mermaid/svg-renderer`). The ASCII renderer works
// from the parsed `Treemap` directly.
// ============================================================================

/** One `classDef` style item, e.g. `fill:#f96`. */
export interface TreemapStyle {
  key: string
  value: string
}

/**
 * A node of the treemap. A node with `value` is a leaf (`"name": 12`); one
 * without is a section whose indented rows are its children (a section with
 * no children draws as a leaf of value 0, as in Mermaid).
 */
export interface TreemapNode {
  name: string
  /** Leaves only; a section's value is the sum of its leaves. */
  value?: number
  /** The `:::class` name, when it names a `classDef`. */
  classSelector?: string
  /** The styles of that class (empty when the class is undefined). */
  styles: TreemapStyle[]
  /** Sections only. */
  children?: TreemapNode[]
}

/** A parsed Mermaid treemap diagram. */
export interface Treemap {
  /** The top-level rows (Mermaid's root is an unnamed node holding these). */
  roots: TreemapNode[]
  title?: string
}

/** A section header or a leaf cell, in the `TreemapLayout` order. */
export interface PositionedTreemapLabel {
  text: string
  x: number
  y: number
  fontSize: number
}

/** A section (a node with children). */
export interface PositionedTreemapSection {
  name: string
  depth: number
  x: number
  y: number
  width: number
  height: number
  /** Index into the colour scale; 0 is transparent. */
  color: number
  value: number
  styles: TreemapStyle[]
  /** The (possibly truncated) header label, empty when none fits. */
  label: PositionedTreemapLabel
  /** The formatted total, absent with `showValues: false` or a zero total. */
  valueLabel?: PositionedTreemapLabel
}

/** A leaf cell. */
export interface PositionedTreemapLeaf {
  name: string
  x: number
  y: number
  width: number
  height: number
  color: number
  value: number
  styles: TreemapStyle[]
  /** Absent when the name does not fit the cell. */
  label?: PositionedTreemapLabel
  /** Absent when the value does not fit under the label. */
  valueLabel?: PositionedTreemapLabel
}

/** A treemap ready to draw; all coordinates are relative to the viewBox origin. */
export interface PositionedTreemap {
  width: number
  height: number
  title?: { text: string; x: number; y: number }
  /** Translation that puts the drawn content 8px inside the viewBox. */
  offsetX: number
  offsetY: number
  /** Extra drop of the tree below the title (0 without one). */
  treeOffsetY: number
  sections: PositionedTreemapSection[]
  leaves: PositionedTreemapLeaf[]
}
