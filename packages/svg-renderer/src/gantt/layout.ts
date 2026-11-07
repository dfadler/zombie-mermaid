// ============================================================================
// Gantt chart layout
//
// Turns a parsed GanttChart into absolute SVG geometry, following Mermaid's
// ganttRenderer.js (default `gantt` config, mermaid@12.3.0):
//
//   - the frame is `width` wide (Mermaid: its container; 1200 when unknown) and
//     2 * 50px plus 24px per row tall; a row is a 20px bar and a 4px gap
//   - the time scale maps [earliest start, latest end] of every task onto
//     0..width - 150 (75px left and right), rounded to whole pixels
//   - rows are in source order, or packed per section in `compact` mode; the
//     DOM/paint order is by start date with `vert` markers last
//   - a milestone is a bar-height square centred on its date; a `vert` marker
//     is a 1.6px line from y 35 down past the last row
//   - a label sits centred in its bar if it fits, else just right of it, or
//     just left of it when the right side would run past the frame
//   - the axis is d3's: ticks from `timeTicks`, a half pixel off the scale
//
// Text widths come from this library's own metrics for its own font, not
// Mermaid's "trebuchet ms", so the inside/outside decision for a label that
// nearly fits can differ.
// ============================================================================

import {
  formatD3Time,
  isExcludedDate,
  timeTicks,
  type GanttChart,
  type GanttTask,
  type PositionedGanttAxis,
  type PositionedGanttChart,
  type PositionedGanttTask,
} from '@zombie-mermaid/mermaid-parser'
import { estimateTextWidth } from '../styles.ts'

/** Mermaid's default `gantt` config. */
export const GANTT = {
  titleTopMargin: 25,
  barHeight: 20,
  barGap: 4,
  topPadding: 50,
  rightPadding: 75,
  leftPadding: 75,
  gridLineStartPadding: 35,
  fontSize: 11,
  sectionFontSize: 11,
  numberSectionStyles: 4,
  /** Mermaid's fallback when its container has no width. */
  defaultWidth: 1200,
} as const

export interface GanttLayoutOptions {
  /** Frame width in px. Default 1200. */
  width?: number
  /** The clock for the `todayMarker` line (default `Date.now()`). */
  now?: number
}

const GAP = GANTT.barHeight + GANTT.barGap

/** Mermaid's getMaxIntersections: pack one section's tasks onto the fewest rows. */
function packSection(
  tasks: GanttTask[],
  offset: number,
  orders: Map<GanttTask, number>,
) {
  const timeline = tasks.map(() => -Infinity)
  const sorted = [...tasks].sort(
    (a, b) => a.start - b.start || a.order - b.order,
  )
  let max = 0
  for (const t of sorted) {
    for (let j = 0; j < timeline.length; j++) {
      if (t.start >= timeline[j]!) {
        timeline[j] = t.end
        orders.set(t, j + offset)
        if (j > max) max = j
        break
      }
    }
  }
  return max
}

const MS_PER = {
  millisecond: 1,
  second: 1000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
  month: 2_629_800_000,
} as const

/** Layout a parsed gantt chart. */
export function layoutGantt(
  chart: GanttChart,
  opts: GanttLayoutOptions = {},
): PositionedGanttChart {
  const w = opts.width ?? GANTT.defaultWidth
  const all = chart.tasks
  const rowTasks = all.filter((t) => !t.vert)

  // Sections in order of first row task; their styles cycle through four.
  const categories: string[] = []
  for (const t of rowTasks)
    if (!categories.includes(t.section)) categories.push(t.section)
  const styleOf = (section: string) => {
    const i = categories.indexOf(section)
    return (i < 0 ? 0 : i) % GANTT.numberSectionStyles
  }

  const orders = new Map<GanttTask, number>()
  const heights = new Map<string, number>()
  let h = 2 * GANTT.topPadding
  if (chart.displayMode === 'compact') {
    let offset = 0
    for (const cat of categories) {
      const inCat = rowTasks.filter((t) => t.section === cat)
      const rows = packSection(inCat, offset, orders) + 1
      offset += rows
      h += rows * GAP
      heights.set(cat, rows)
    }
  } else {
    for (const t of rowTasks) orders.set(t, t.order)
    h += rowTasks.length * GAP
    for (const cat of categories) {
      heights.set(cat, rowTasks.filter((t) => t.section === cat).length)
    }
  }
  const orderOf = (t: GanttTask) => (t.vert ? -1 : (orders.get(t) ?? t.order))

  const span = w - GANTT.leftPadding - GANTT.rightPadding
  const t0 = all.length ? Math.min(...all.map((t) => t.start)) : 0
  const t1 = all.length ? Math.max(...all.map((t) => t.end)) : 0
  // The d3 scaleTime(...).rangeRound: a degenerate domain maps to the midpoint.
  const scale = (t: number) =>
    Math.round(t1 === t0 ? span / 2 : ((t - t0) / (t1 - t0)) * span)

  // Paint order: by start (stable), `vert` last.
  const sorted = [...all]
    .sort((a, b) => (a.start > b.start ? 1 : a.start < b.start ? -1 : 0))
    .sort((a, b) => (a.vert === b.vert ? 0 : a.vert ? 1 : -1))

  const tasks: PositionedGanttTask[] = sorted.map((t) => {
    const order = orderOf(t)
    const sx = scale(t.start)
    const ex = scale(t.end)
    const renderEx = scale(t.renderEnd ?? t.end)
    let x = sx + GANTT.leftPadding
    let width = renderEx - sx
    let y = order * GAP + GANTT.topPadding
    let height: number = GANTT.barHeight
    if (t.milestone) {
      x = sx + GANTT.leftPadding + 0.5 * (ex - sx) - 0.5 * GANTT.barHeight
      width = GANTT.barHeight
    } else if (t.vert) {
      width = 0.08 * GANTT.barHeight
    }
    if (t.vert) {
      y = GANTT.gridLineStartPadding
      height = rowTasks.length * GAP + GANTT.barHeight * 2
    }
    const originX = sx + GANTT.leftPadding + 0.5 * (ex - sx)
    const originY = order * GAP + GANTT.topPadding + 0.5 * GANTT.barHeight

    // Label
    const textW = estimateTextWidth(t.label, GANTT.fontSize, 400)
    let startX = sx
    let endX = renderEx
    if (t.milestone) {
      startX += 0.5 * (ex - sx) - 0.5 * GANTT.barHeight
      endX = startX + GANTT.barHeight
    }
    let tx: number
    let anchor: 'start' | 'middle' | 'end' = 'middle'
    let outside: 'left' | 'right' | null = null
    // The class decision uses endX from scale(end), not renderEnd (as Mermaid does).
    let classEnd = ex
    if (t.milestone) classEnd = sx + GANTT.barHeight
    const overflow = textW > (t.vert ? 0 : endX - startX)
    const classOverflow = textW > classEnd - sx
    if (t.vert) {
      tx = sx + GANTT.leftPadding
    } else if (overflow) {
      if (endX + textW + 1.5 * GANTT.leftPadding > w) {
        tx = startX + GANTT.leftPadding - 5
      } else {
        tx = endX + GANTT.leftPadding + 5
      }
    } else {
      tx = (endX - startX) / 2 + startX + GANTT.leftPadding
    }
    if (classOverflow) {
      if (classEnd + textW + 1.5 * GANTT.leftPadding > w) {
        outside = 'left'
        anchor = 'end'
      } else {
        outside = 'right'
        anchor = 'start'
      }
    }
    const ty = t.vert
      ? GANTT.gridLineStartPadding + rowTasks.length * GAP + 60
      : order * GAP +
        GANTT.barHeight / 2 +
        (GANTT.fontSize / 2 - 2) +
        GANTT.topPadding
    return {
      id: t.id,
      x,
      y,
      width,
      height,
      originX,
      originY,
      sectionStyle: styleOf(t.section),
      task: t,
      text: { text: t.label, x: tx, y: ty, anchor, outside },
    }
  })

  // Stripes: one per used row, in paint order of the first task on it.
  const seen = new Set<number>()
  const rows: PositionedGanttChart['rows'] = []
  for (const p of tasks) {
    if (p.task.vert) continue
    const o = orderOf(p.task)
    if (seen.has(o)) continue
    seen.add(o)
    rows.push({
      y: o * GAP + GANTT.topPadding - 2,
      width: w - GANTT.rightPadding / 2,
      height: GAP,
      sectionStyle: p.sectionStyle,
    })
  }

  // Excluded days
  const excludeRanges: PositionedGanttChart['excludeRanges'] = []
  if ((chart.excludes.length > 0 || chart.includes.length > 0) && all.length) {
    const DAY = 86_400_000
    if (t1 - t0 <= 5 * 366 * DAY) {
      const invalid = (ms: number) => isExcludedDate(chart, ms)
      let range: { start: number; end: number } | null = null
      for (let d = t0; d <= t1; d += DAY) {
        if (invalid(d)) {
          if (!range) range = { start: d, end: d }
          else range.end = d
        } else if (range) {
          excludeRanges.push(toRect(range))
          range = null
        }
      }
      // A range still open at the last day is not drawn: Mermaid only closes
      // a range when a non-excluded day follows it.
    }
  }
  function toRect(r: { start: number; end: number }) {
    const DAY = 86_400_000
    const sod = (t: number) => Math.floor(t / DAY) * DAY
    const x0 = scale(sod(r.start))
    const x1 = scale(sod(r.end) + DAY - 1)
    return {
      id: formatD3Time(r.start, '%Y-%m-%d'),
      x: x0 + GANTT.leftPadding,
      y: GANTT.gridLineStartPadding,
      width: x1 - x0,
      height: h - GANTT.topPadding - GANTT.gridLineStartPadding,
    }
  }

  // Axes
  const axisFormat =
    chart.axisFormat || (chart.dateFormat === 'D' ? '%d' : '%Y-%m-%d')
  let custom = chart.tickInterval
  if (custom && all.length) {
    const est = Math.ceil(
      (t1 - t0) / (custom.every * MS_PER[custom.unit as keyof typeof MS_PER]),
    )
    if (est > 10_000) custom = undefined
  }
  const tickSize = -h + GANTT.topPadding + GANTT.gridLineStartPadding
  const makeAxis = (position: 'top' | 'bottom'): PositionedGanttAxis => ({
    x: GANTT.leftPadding,
    y: position === 'bottom' ? h - 50 : GANTT.topPadding,
    position,
    tickSize,
    rangeEnd: span,
    ticks: all.length
      ? timeTicks(t0, t1, custom, chart.weekday).map((t) => ({
          x: scale(t) + 0.5,
          label: formatD3Time(t, axisFormat),
        }))
      : [],
  })
  const axes = [makeAxis('bottom')]
  if (chart.topAxis) axes.push(makeAxis('top'))

  // Section labels
  const sectionLabels: PositionedGanttChart['sectionLabels'] = []
  let before = 0
  for (const cat of categories) {
    const n = heights.get(cat)!
    sectionLabels.push({
      lines: cat.split(/<br\s*\/?>|\n/i),
      y: (n * GAP) / 2 + before * GAP + GANTT.topPadding,
      sectionStyle: styleOf(cat),
    })
    before += n
  }

  const out: PositionedGanttChart = {
    width: w,
    height: h,
    excludeRanges,
    axes,
    rows,
    tasks,
    sectionLabels,
  }
  if (chart.title) {
    out.title = { text: chart.title, x: w / 2, y: GANTT.titleTopMargin }
  }
  if (chart.todayMarker !== 'off' && all.length) {
    const now = opts.now ?? Date.now()
    const nx = scale(now)
    // Off the chart the line is invisible; leave it out so output stays stable.
    if (now >= t0 && now <= t1) {
      out.today = {
        x: nx + GANTT.leftPadding,
        y1: GANTT.titleTopMargin,
        y2: h - GANTT.titleTopMargin,
        style: chart.todayMarker.replace(/,/g, ';'),
      }
    }
  }
  return out
}
