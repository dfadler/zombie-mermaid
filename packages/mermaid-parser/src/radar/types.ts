// ============================================================================
// Radar types
//
// The parsed model of a Mermaid `radar-beta` diagram, plus the positioned
// model the SVG renderer draws (`PositionedRadar`, produced by `layoutRadar`
// in `@zombie-mermaid/svg-renderer`). The ASCII renderer works from the parsed
// `Radar` directly.
// ============================================================================

/** One spoke of the radar. */
export interface RadarAxis {
  /** The identifier the axis is referred to by in a `curve`. */
  name: string
  /** The drawn text: the `["…"]` label, or the name. */
  label: string
}

/** One data series. */
export interface RadarCurve {
  name: string
  /** The legend text: the `["…"]` label, or the name. */
  label: string
  /** One value per axis, in axis order (reference entries are already ordered). */
  entries: number[]
}

/** The `showLegend` / `ticks` / `max` / `min` / `graticule` options, defaults applied. */
export interface RadarOptions {
  showLegend: boolean
  /** Number of rings; Mermaid caps it at 32. */
  ticks: number
  /** Value at the outer ring; `null` means the largest entry of any curve. */
  max: number | null
  /** Value at the centre. */
  min: number
  graticule: 'circle' | 'polygon'
}

/** A parsed Mermaid radar chart. */
export interface Radar {
  /** `title …`; the last one wins. */
  title?: string
  axes: RadarAxis[]
  curves: RadarCurve[]
  options: RadarOptions
}

/** A ring of the graticule: a circle, or a polygon with one corner per axis. */
export type PositionedRadarRing =
  | { kind: 'circle'; r: number }
  | { kind: 'polygon'; points: Array<{ x: number; y: number }> }

/** A spoke and its label. */
export interface PositionedRadarAxis {
  /** End of the spoke; it starts at the centre. */
  x2: number
  y2: number
  label: string
  labelX: number
  labelY: number
  anchor: 'start' | 'middle' | 'end'
  baseline: 'hanging' | 'auto' | 'central'
}

/** A data series ready to draw. */
export interface PositionedRadarCurve {
  /** Index in the source: Mermaid's `radarCurve-N` colour class. */
  index: number
  /** `path` for circle graticules (a closed bezier), `polygon` otherwise. */
  kind: 'path' | 'polygon'
  /** The `d` of a `path`. */
  d?: string
  /** The corners of a `polygon`. */
  points?: Array<{ x: number; y: number }>
}

/** A legend row. */
export interface PositionedRadarLegendItem {
  index: number
  label: string
  x: number
  y: number
}

/** A radar ready to draw; the origin of the coordinates is the centre of the chart. */
export interface PositionedRadar {
  width: number
  height: number
  /** Where the origin sits in the viewBox. */
  centerX: number
  centerY: number
  rings: PositionedRadarRing[]
  axes: PositionedRadarAxis[]
  curves: PositionedRadarCurve[]
  legend: PositionedRadarLegendItem[]
  /** Mermaid always writes the title element, empty when there is no title. */
  title: { text: string; x: number; y: number }
}
