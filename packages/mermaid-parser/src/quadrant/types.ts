// ============================================================================
// Quadrant chart types
//
// The parsed (logical) model of a Mermaid `quadrantChart`, plus the positioned
// model the SVG renderer draws (`PositionedQuadrantChart`, produced by
// `layoutQuadrantChart` in `@zombie-mermaid/svg-renderer`). The ASCII renderer
// works from the parsed `QuadrantChart` directly, like pie and xychart do.
// ============================================================================

/** The point styles Mermaid accepts: `radius`, `color`, `stroke-color`, `stroke-width`. */
export interface QuadrantPointStyle {
  /** `radius: 10`; whole pixels. */
  radius?: number
  /** `color: #ff3300`, always with a leading `#`. */
  color?: string
  /** `stroke-color: #00ff33`, always with a leading `#`. */
  strokeColor?: string
  /** `stroke-width: 5px`, as written (`<digits>px`). */
  strokeWidth?: string
}

/** One data point. `x` and `y` are in 0..1 (Mermaid's grammar allows no other values). */
export interface QuadrantPoint extends QuadrantPointStyle {
  label: string
  x: number
  y: number
  /** The `:::name` class, when the point names one. */
  className?: string
}

/** A parsed Mermaid quadrant chart. */
export interface QuadrantChart {
  title?: string
  /** `x-axis Left --> Right`: the text under the left half. */
  xAxisLeft?: string
  /** The text under the right half; absent for a one-sided `x-axis Left`. */
  xAxisRight?: string
  /** `y-axis Bottom --> Top`: the text beside the lower half. */
  yAxisBottom?: string
  /** The text beside the upper half; absent for a one-sided `y-axis Bottom`. */
  yAxisTop?: string
  /**
   * `quadrant-1`..`quadrant-4` labels, in that order: 1 is top right, 2 top
   * left, 3 bottom left, 4 bottom right. Empty string when not given.
   */
  quadrants: [string, string, string, string]
  /**
   * Points in source order. Each carries its effective style: the point's own
   * styles over its `classDef` class's (Mermaid resolves classes at build
   * time, so a `classDef` after the point still applies).
   */
  points: QuadrantPoint[]
  /** `classDef` styles by class name. */
  classes: Record<string, QuadrantPointStyle>
}

/** Text anchored at a position, in SVG terms. */
export interface PositionedQuadrantText {
  text: string
  x: number
  y: number
  fontSize: number
  /** `start` for a one-sided axis label, otherwise `middle`. */
  anchor: 'start' | 'middle'
  /** `hanging` (y is the top of the text) or `middle`. */
  baseline: 'hanging' | 'middle'
  /** 0 or -90 (the y-axis labels). */
  rotation: number
}

export interface PositionedQuadrantCell {
  /** 0..3 for `quadrant-1`..`quadrant-4`. */
  index: number
  x: number
  y: number
  width: number
  height: number
  text: PositionedQuadrantText
}

export interface PositionedQuadrantLine {
  x1: number
  y1: number
  x2: number
  y2: number
  strokeWidth: number
  /** `external` frame lines or the `internal` cross. */
  kind: 'external' | 'internal'
}

export interface PositionedQuadrantPoint {
  x: number
  y: number
  radius: number
  color?: string
  strokeColor?: string
  strokeWidth: string
  text: PositionedQuadrantText
}

export interface PositionedQuadrantChart {
  width: number
  height: number
  title?: PositionedQuadrantText
  quadrants: PositionedQuadrantCell[]
  lines: PositionedQuadrantLine[]
  axisLabels: PositionedQuadrantText[]
  /** In paint order (bottom first): Mermaid draws the last source point first. */
  points: PositionedQuadrantPoint[]
}
