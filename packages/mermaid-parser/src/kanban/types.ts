import type { MindmapTextRun } from '../mindmap/types.ts'

// ============================================================================
// Kanban types
//
// The parsed model of a Mermaid `kanban` diagram, plus the positioned model the
// SVG renderer draws (`PositionedKanban`, produced by `layoutKanban` in
// `@zombie-mermaid/svg-renderer`). The ASCII renderer works from the parsed
// `Kanban` directly.
// ============================================================================

/** One card (Mermaid calls it an item). */
export interface KanbanCard {
  /** The id written in front of the text, else the text (Mermaid's node id). */
  id: string
  /** The label as written, entities decoded. May hold `\n` and `<br>` breaks. */
  text: string
  /** `@{ ticket: MC-2038 }`. */
  ticket?: string
  /** `@{ assigned: 'knsv' }`. */
  assigned?: string
  /**
   * `@{ priority: 'High' }`: `Very High` (red), `High` (orange), `Low` (blue)
   * and `Very Low` (light blue) draw a bar on the card's left edge, `Medium`
   * and any other value draw none.
   */
  priority?: string
  /** `::icon(fa fa-x)`; recorded, never drawn (no icon font is loaded). */
  icon?: string
  /** `:::cls` classes. */
  className?: string
}

/** One column (Mermaid calls it a section) and its cards. */
export interface KanbanColumn {
  id: string
  text: string
  cards: KanbanCard[]
  /** `:::cls` classes. */
  className?: string
}

/** A parsed Mermaid kanban board. */
export interface Kanban {
  columns: KanbanColumn[]
  /** `kanban.sectionWidth` / `kanban.ticketBaseUrl` from front matter or `%%{init}%%`. */
  config?: { sectionWidth?: number; ticketBaseUrl?: string }
}

/** A line of text and where it starts, relative to the viewBox origin. */
export interface PositionedKanbanText {
  /** The wrapped lines of styled runs (Markdown bold and italic). */
  lines: MindmapTextRun[][]
  x: number
  /** Top of the text block. */
  y: number
  width: number
  height: number
}

/** A card, ready to draw. */
export interface PositionedKanbanCard {
  /** Centre of the card. */
  cx: number
  cy: number
  width: number
  height: number
  title: PositionedKanbanText
  ticket?: PositionedKanbanText
  assigned?: PositionedKanbanText
  /** Link target for the ticket (`kanban.ticketBaseUrl` with `#TICKET#` replaced). */
  ticketUrl?: string
  /** Colour of the priority bar: `''` for a bar with no stroke (`Medium`, unknown names); absent when the card has no priority. */
  priorityColor?: string
  className?: string
}

/** A column, ready to draw. */
export interface PositionedKanbanColumn {
  x: number
  y: number
  width: number
  height: number
  /** `section-N` colour class number (1-based, as Mermaid numbers them). */
  colorClass: number
  label: PositionedKanbanText
  className?: string
  cards: PositionedKanbanCard[]
}

/** A board ready to draw; all coordinates are in Mermaid's own space (see `viewBox`). */
export interface PositionedKanban {
  viewBox: { x: number; y: number; width: number; height: number }
  columns: PositionedKanbanColumn[]
}
