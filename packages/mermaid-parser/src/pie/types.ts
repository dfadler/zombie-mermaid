// ============================================================================
// Pie chart types
//
// The parsed (logical) model of a Mermaid `pie` diagram. Positioned/layout
// types for the SVG and ASCII renderers are deliberately not here yet — they
// arrive with those renderers.
//
// Shape adapted from lukilabs/beautiful-mermaid#151 (birenroy), extended with
// the accessibility fields Mermaid's own pie grammar accepts.
// ============================================================================

/** One slice of a pie chart, in source order. */
export interface PieSlice {
  /** Slice label, with its surrounding quotes removed and escapes resolved. */
  label: string
  /** Slice value. Never negative; zero is allowed (Mermaid accepts it). */
  value: number
}

/** A parsed Mermaid pie chart. */
export interface PieChart {
  /** `title …`, either on the `pie` header line or on its own line. */
  title?: string
  /** `accTitle: …` accessible title. */
  accTitle?: string
  /** `accDescr: …` or multi-line `accDescr { … }` accessible description. */
  accDescr?: string
  /** `pie showData` — show each slice's raw value next to its legend label. */
  showData: boolean
  /**
   * Slices in source order. A label that repeats keeps its first value and
   * position; later duplicates are ignored, as in Mermaid. May be empty:
   * Mermaid accepts a bare `pie` with no slices.
   */
  slices: PieSlice[]
}
