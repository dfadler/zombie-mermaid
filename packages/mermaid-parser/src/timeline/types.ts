// ============================================================================
// Timeline types
//
// The parsed model of a Mermaid `timeline` diagram, plus the positioned model
// the SVG renderer draws (`PositionedTimeline`, produced by `layoutTimeline`
// in `@zombie-mermaid/svg-renderer`). The ASCII renderer works from the parsed
// `Timeline` directly.
// ============================================================================

/** One period (Mermaid calls it a task) and the events listed under it. */
export interface TimelinePeriod {
  /** Name of the `section` this period was written under; `''` before any section. */
  section: string
  /** The period's label (`2004`, `Bronze Age`), trimmed. */
  label: string
  /** Events in source order. May be empty. */
  events: string[]
}

/** A parsed Mermaid timeline. */
export interface Timeline {
  /** `timeline LR` (the default) lays periods out left to right; `timeline TD` top to bottom. */
  direction: 'LR' | 'TD'
  /** `title …`; the last one wins. */
  title?: string
  /** Section names in source order (a name written twice is listed twice, as in Mermaid). */
  sections: string[]
  /** Periods in source order. */
  periods: TimelinePeriod[]
}

/** A box on the timeline: a section heading, a period or an event. */
export interface PositionedTimelineNode {
  kind: 'section' | 'period' | 'event'
  x: number
  y: number
  width: number
  height: number
  /** The text, wrapped to the lines Mermaid breaks it into. */
  lines: string[]
  /** Mermaid's `section-N` colour class number (`-1` for the first colour). */
  colorClass: number
  /** Space around the text; the text block is placed `padding / 2` from the top. */
  padding: number
}

/** A dashed line from a period down (LR) or across (TD) to its events. */
export interface PositionedTimelineConnector {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** A timeline ready to draw; all coordinates are relative to the viewBox origin. */
export interface PositionedTimeline {
  direction: 'LR' | 'TD'
  width: number
  height: number
  /** Heading text and baseline anchor, when the diagram has a title. */
  title?: { text: string; x: number; y: number; fontSize: number }
  nodes: PositionedTimelineNode[]
  connectors: PositionedTimelineConnector[]
  /** The arrowed main axis. */
  axis: { x1: number; y1: number; x2: number; y2: number }
}
