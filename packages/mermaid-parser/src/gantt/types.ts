// ============================================================================
// Gantt chart types
//
// The parsed model of a Mermaid `gantt`: dates are already resolved (the
// `after`/`until` references, durations and `excludes` are applied), so both
// renderers only draw. Times are UTC milliseconds.
// ============================================================================

import type { TickInterval } from './dates.ts'

/** One task or milestone, as scheduled. */
export interface GanttTask {
  id: string
  label: string
  /** The `section` it sits under; `''` for tasks before the first section. */
  section: string
  start: number
  /** The scheduled end (moved past `excludes` days). */
  end: number
  /** Where the bar is drawn to; differs from `end` when `excludes` stretched it. */
  renderEnd: number | null
  active: boolean
  done: boolean
  crit: boolean
  milestone: boolean
  /** `vert`: a vertical marker line, not a row. */
  vert: boolean
  /** Source order among row tasks (`-1` for `vert`). Compact mode rewrites it. */
  order: number
  /** `clickable` once a `click` statement names the task. */
  classes: string[]
  /** The `click ... href` target, when there is one. */
  link?: string
}

export type GanttWeekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

/** A parsed Mermaid gantt chart. */
export interface GanttChart {
  title?: string
  /** `dateFormat`, trimmed; `''` when not given. */
  dateFormat: string
  /** `axisFormat` as written (leading blanks kept, as Mermaid prints them); `''` when not given. */
  axisFormat: string
  /** `tickInterval 1week`, parsed; unset when absent or not of the form Mermaid reads. */
  tickInterval?: TickInterval
  /** `todayMarker`: `''` (default line), `'off'`, or CSS (`stroke-width:5px,stroke:#0f0`). */
  todayMarker: string
  includes: string[]
  excludes: string[]
  inclusiveEndDates: boolean
  topAxis: boolean
  weekday: GanttWeekday
  weekend: 'friday' | 'saturday'
  /** `compact` packs non-overlapping tasks of a section onto one row. */
  displayMode: '' | 'compact'
  /** Section names in order of appearance. */
  sections: string[]
  /** Tasks in source order. */
  tasks: GanttTask[]
}

// ---------------------------------------------------------------------------
// Positioned model (produced by `layoutGantt` in `@zombie-mermaid/svg-renderer`)
// ---------------------------------------------------------------------------

export interface PositionedGanttText {
  text: string
  x: number
  y: number
  /** `middle` inside the bar, `start`/`end` when the label sits outside it. */
  anchor: 'start' | 'middle' | 'end'
  /** Where an overflowing label went; `null` when it fits inside the bar. */
  outside: 'left' | 'right' | null
}

export interface PositionedGanttTask {
  id: string
  x: number
  y: number
  width: number
  height: number
  /** Centre the milestone diamond rotates about, in px. */
  originX: number
  originY: number
  /** Section index modulo 4 (0..3): picks the colour. */
  sectionStyle: number
  task: GanttTask
  text: PositionedGanttText
}

export interface PositionedGanttTick {
  /** Offset along the axis (a half pixel off the scale, as d3 draws it). */
  x: number
  label: string
}

export interface PositionedGanttAxis {
  /** Where the axis group sits, `translate(x, y)`. */
  x: number
  y: number
  position: 'top' | 'bottom'
  /** Length of a tick line (negative for the bottom axis: drawn upwards). */
  tickSize: number
  rangeEnd: number
  ticks: PositionedGanttTick[]
}

export interface PositionedGanttChart {
  width: number
  height: number
  title?: { text: string; x: number; y: number }
  /** Shaded `excludes` ranges. */
  excludeRanges: {
    id: string
    x: number
    y: number
    width: number
    height: number
  }[]
  axes: PositionedGanttAxis[]
  /** Section stripes, one per used row. */
  rows: { y: number; width: number; height: number; sectionStyle: number }[]
  /** Task rects and labels, in Mermaid's draw order (by start, `vert` last). */
  tasks: PositionedGanttTask[]
  sectionLabels: { lines: string[]; y: number; sectionStyle: number }[]
  /** The `todayMarker` line when today falls inside the chart. */
  today?: { x: number; y1: number; y2: number; style: string }
}
