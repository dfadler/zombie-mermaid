// ============================================================================
// Pie chart types
//
// The parsed (logical) model of a Mermaid `pie` diagram, plus the positioned
// model the SVG renderer draws (`PositionedPieChart`, produced by
// `layoutPieChart` in `@zombie-mermaid/svg-renderer`). The ASCII renderer
// works from the parsed `PieChart` directly, like xychart's does.
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

// ============================================================================
// Positioned pie chart — ready for SVG rendering
//
// Geometry follows Mermaid's own pieRenderer.ts: a 450px-tall frame, a pie of
// radius 185 centred at (225, 225) before any viewBox shift, slices drawn
// clockwise from 12 o'clock in source order, percentage labels at 0.75 of the
// radius, and a legend to the right. All coordinates here are absolute SVG
// user units with the viewBox already shifted to start at (0, 0).
// ============================================================================

/** One drawn slice. Slices under 1% of the total are never positioned. */
export interface PositionedPieSlice {
  /** Slice label (as parsed). */
  label: string
  /** Slice value (as parsed). */
  value: number
  /**
   * Palette slot: the slice's index among *all* slices in source order,
   * modulo 12 — Mermaid's `pie1`..`pie12` colour scale is keyed by every
   * label, including slices too small to draw, and wraps after 12.
   */
  colorIndex: number
  /** Start angle, radians clockwise from 12 o'clock. */
  startAngle: number
  /** End angle, radians clockwise from 12 o'clock. */
  endAngle: number
  /** SVG path data for the wedge (or full circle for a 100% slice). */
  path: string
  /** Percentage label, `((value / total) * 100).toFixed(0) + '%'` as in Mermaid. */
  percentText: string
  /** Anchor of the percentage label (text-anchor middle, alphabetic baseline). */
  labelX: number
  labelY: number
}

/** One legend row: a colour swatch and its label. Every slice gets one. */
export interface PositionedPieLegendItem {
  /** Row text: the label, or `label [value]` when `showData` is on. */
  text: string
  colorIndex: number
  /** Top-left corner of the square swatch. */
  x: number
  y: number
  /** Swatch side length. */
  size: number
  /** Text anchor (text-anchor start, alphabetic baseline). */
  textX: number
  textY: number
}

export interface PositionedPieChart {
  width: number
  height: number
  /** Pie centre. */
  cx: number
  cy: number
  /** Slice radius. */
  radius: number
  /** Radius of the outline circle drawn around the pie. */
  outerRadius: number
  /** Title text and its anchor (text-anchor middle, alphabetic baseline). */
  title?: { text: string; x: number; y: number }
  /** Drawn slices, in source order. */
  slices: PositionedPieSlice[]
  /** Legend rows, one per parsed slice, in source order. */
  legend: PositionedPieLegendItem[]
  /** `accTitle`, carried through for the SVG accessible name. */
  accTitle?: string
  /** `accDescr`, carried through for the SVG `<desc>`. */
  accDescr?: string
}
