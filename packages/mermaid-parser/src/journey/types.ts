// ============================================================================
// User journey types
//
// The parsed model of a Mermaid `journey` diagram, plus the positioned model
// the SVG renderer draws (`PositionedJourney`, produced by `layoutJourney` in
// `@zombie-mermaid/svg-renderer`). The ASCII renderer works from the parsed
// `Journey` directly.
// ============================================================================

/** One task of a journey. */
export interface JourneyTask {
  /** Name of the `section` this task was written under; `''` before any section. */
  section: string
  /** The task's label, trimmed. */
  name: string
  /**
   * Satisfaction score. Mermaid takes `Number(text)`, so it is not limited to
   * 1-5 and is `NaN` for a non-numeric score.
   */
  score: number
  /** Actors taking part, as written (trimmed; may include `''`). */
  actors: string[]
}

/** A parsed Mermaid journey. */
export interface Journey {
  /** `title …`; the last one wins. */
  title?: string
  /** Section names in source order (a name written twice is listed twice, as in Mermaid). */
  sections: string[]
  /** Tasks in source order. */
  tasks: JourneyTask[]
  /** Every actor, de-duplicated and sorted as Mermaid sorts them (`Array.sort()`). */
  actors: string[]
}

/** A section heading bar. */
export interface PositionedJourneySection {
  x: number
  y: number
  width: number
  height: number
  text: string
  /** `section-type-N`, `N` cycling over Mermaid's 7 section fills. */
  num: number
}

/** A task box with its dashed score line, face and actor dots. */
export interface PositionedJourneyTask {
  x: number
  y: number
  width: number
  height: number
  /** The label wrapped to the lines the box shows. */
  lines: string[]
  score: number
  num: number
  /** Where the face sits (`300 + (5 - score) * 30`). */
  faceY: number
  /** Where the dashed score line ends. */
  lineEndY: number
  /** Actor dots on the box's top edge, each with its legend index. */
  dots: { cx: number; cy: number; actor: string; pos: number }[]
}

/** One row of the actor legend. */
export interface PositionedJourneyLegendRow {
  cx: number
  cy: number
  pos: number
  /** Wrapped label lines, each at `y`. */
  lines: { text: string; x: number; y: number }[]
}

/** A journey ready to draw; y is relative to the viewBox top (already shifted by Mermaid's -25 origin). */
export interface PositionedJourney {
  width: number
  height: number
  title?: { text: string; x: number; y: number }
  legend: PositionedJourneyLegendRow[]
  sections: PositionedJourneySection[]
  tasks: PositionedJourneyTask[]
  axis: { x1: number; y1: number; x2: number; y2: number }
}
