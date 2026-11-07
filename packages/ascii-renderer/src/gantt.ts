// ============================================================================
// ASCII renderer — Gantt chart
//
// Mermaid has no text mode for gantt charts, so there is no reference output
// to match. This draws the SVG's picture on a character grid:
//
//                     A Gantt Diagram
//
//                      ┬────────┬────────┬────────┬────────┬────────
//   Section            ...
//   Section
//     A task           █████████████
//     Another task              ██████████████
//                      ┬─────────┬─────────┬─────────┬─────────
//                      Jan 01    Jan 15    ...
//
//     █ task  ▒ active  ░ done  ▓ crit  ◆ milestone
//
//   - Left column: section names as header rows, task labels indented under
//     them (display-width aware, capped at MAX_LABEL columns with an ellipsis).
//     A crit task that is also done or active keeps that glyph and gets a
//     ` !` after its label. In `displayMode compact` the parser has already
//     packed tasks onto shared rows; their labels are joined with `, `.
//   - Right: a TIMELINE_WIDTH column area mapping [first start, last end] of
//     the row tasks linearly onto columns. The axis (below, and above too for
//     `topAxis`) uses the same ticks and labels as Mermaid's axis (`timeTicks`
//     + `formatD3Time`); a label that would overlap another is dropped, the
//     first and last tick winning.
//   - Bars: `█` task, `▒` active, `░` done, `▓` crit; at least one column;
//     drawn to `renderEnd` when the parser stretched the task over excluded
//     days. `◆` marks a milestone, centred on its time. A `vert` task is a
//     `┆` line through every row, with its label under the axis.
//   - Legend lists only the glyph kinds that appear.
//
// Deliberately not drawn: `excludes`/`includes` shading (bars already stretch
// over excluded days via `renderEnd`) and the `todayMarker` line (it would make
// the output depend on the clock). accTitle/accDescr are not printed (see the
// pie renderer). All widths are display widths, like everywhere else here.
// ============================================================================

import {
  formatD3Time,
  parseGantt,
  timeTicks,
} from '@zombie-mermaid/mermaid-parser'
import type { GanttTask } from '@zombie-mermaid/mermaid-parser'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'
import { colorizeText } from './ansi.ts'
import { displayWidth, toDisplayCells } from './display-width.ts'

/** Columns of the timeline area. */
const TIMELINE_WIDTH = 60
/** Widest label column (display columns). */
const MAX_LABEL = 32

const UNI = {
  normal: '█',
  active: '▒',
  done: '░',
  crit: '▓',
  milestone: '◆',
  vert: '┆',
  axis: '─',
  tickBottom: '┬',
  tickTop: '┴',
  ellipsis: '…',
}
const ASC = {
  normal: '#',
  active: '=',
  done: '.',
  crit: '%',
  milestone: '*',
  vert: ':',
  axis: '-',
  tickBottom: '+',
  tickTop: '+',
  ellipsis: '...',
}

type Kind = 'normal' | 'active' | 'done' | 'crit' | 'milestone'
const LEGEND: [Kind, string][] = [
  ['normal', 'task'],
  ['active', 'active'],
  ['done', 'done'],
  ['crit', 'crit'],
  ['milestone', 'milestone'],
]

interface Cell {
  ch: string
  hex?: string
}

function kindOf(t: GanttTask): Kind {
  if (t.milestone) return 'milestone'
  if (t.done) return 'done'
  if (t.active) return 'active'
  return t.crit ? 'crit' : 'normal'
}

function fit(s: string, max: number, ellipsis: string): string {
  if (displayWidth(s) <= max) return s
  let out = ''
  for (const c of toDisplayCells(s)) {
    if (displayWidth(out + c) > max - ellipsis.length) break
    out += c
  }
  return out + ellipsis
}

export function renderGanttAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const chart = parseGantt(text)
  const g = config.useAscii ? ASC : UNI
  const paint = (s: string, hex: string): string =>
    colorizeText(s, hex, colorMode)
  const accent = theme.accent ?? theme.fg

  const rowTasks = chart.tasks.filter((t) => !t.vert)
  const verts = chart.tasks.filter((t) => t.vert)
  const lines: string[] = []

  // Rows: section headers, then one row per (section, order) group.
  interface Row {
    header?: string
    tasks: GanttTask[]
  }
  const rows: Row[] = []
  const sectionNames = chart.sections.includes('')
    ? chart.sections
    : ['', ...chart.sections]
  for (const name of sectionNames) {
    const inSection = rowTasks.filter((t) => t.section === name)
    if (inSection.length === 0) continue
    if (name) rows.push({ header: name, tasks: [] })
    const byOrder = new Map<number, GanttTask[]>()
    for (const t of inSection) {
      const k = byOrder.get(t.order) ?? []
      k.push(t)
      byOrder.set(t.order, k)
    }
    for (const k of [...byOrder.keys()].sort((a, b) => a - b)) {
      rows.push({ tasks: byOrder.get(k)! })
    }
  }

  const span = (ts: GanttTask[]): [number, number] => [
    Math.min(...ts.map((t) => t.start)),
    Math.max(...ts.map((t) => t.renderEnd ?? t.end)),
  ]
  const basis = rowTasks.length > 0 ? rowTasks : verts
  const title = chart.title
  if (basis.length === 0) return title ?? ''
  const [t0, t1] = span(basis)
  const frac = (t: number): number =>
    t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 0
  const W = TIMELINE_WIDTH
  const pointCol = (t: number): number => Math.round(frac(t) * (W - 1))

  // Label column.
  const indent = chart.sections.some((s) => s) ? 2 : 0
  const labelOf = (r: Row): string =>
    r.header ??
    ' '.repeat(indent) +
      r.tasks
        .map((t) => t.label + (t.crit && (t.done || t.active) ? ' !' : ''))
        .join(', ')
  const labels = rows.map((r) => fit(labelOf(r), MAX_LABEL, g.ellipsis))
  const labelW = Math.max(0, ...labels.map(displayWidth))
  const gutter = labelW + 1

  // Axis.
  const ticks = timeTicks(t0, t1, chart.tickInterval, chart.weekday).filter(
    (t) => t >= t0 && t <= t1,
  )
  const tickCols = ticks.map(pointCol)
  const axisLine = (tick: string): string => {
    const cells = new Array<string>(W).fill(g.axis)
    for (const c of tickCols) cells[c] = tick
    return ' '.repeat(gutter) + paint(cells.join(''), theme.line)
  }
  const placed: [number, number][] = []
  const labelRow: string[] = []
  const order = ticks.length
    ? [0, ticks.length - 1, ...ticks.map((_, i) => i).slice(1, -1)]
    : []
  const starts = new Map<number, string>()
  for (const i of order) {
    const s = formatD3Time(ticks[i]!, chart.axisFormat || '%Y-%m-%d')
    const w = displayWidth(s)
    const from = Math.max(0, tickCols[i]! - Math.floor(w / 2))
    if (placed.some(([a, b]) => from < b + 1 && from + w > a - 1)) continue
    placed.push([from, from + w])
    starts.set(from, s)
  }
  let at = 0
  for (const from of [...starts.keys()].sort((a, b) => a - b)) {
    labelRow.push(' '.repeat(from - at) + paint(starts.get(from)!, theme.fg))
    at = from + displayWidth(starts.get(from)!)
  }
  const tickLabels = ' '.repeat(gutter) + labelRow.join('')

  if (title) {
    const full = gutter + W
    lines.push(
      ' '.repeat(Math.max(0, Math.floor((full - displayWidth(title)) / 2))) +
        paint(title, theme.fg),
      '',
    )
  }
  if (chart.topAxis) lines.push(tickLabels, axisLine(g.tickTop))

  const vertCols = verts.map((v) => pointCol(v.start))
  const used = new Set<Kind>()
  rows.forEach((r, i) => {
    const cells: (Cell | undefined)[] = new Array<Cell | undefined>(W)
    for (const c of vertCols) cells[c] = { ch: g.vert, hex: theme.line }
    for (const t of r.tasks) {
      const kind = kindOf(t)
      used.add(kind)
      const hex = kind === 'done' ? theme.line : accent
      if (kind === 'milestone') {
        cells[pointCol(t.start)] = { ch: g.milestone, hex }
        continue
      }
      const a = Math.min(W - 1, Math.floor(frac(t.start) * W))
      const b = Math.min(
        W,
        Math.max(a + 1, Math.ceil(frac(t.renderEnd ?? t.end) * W)),
      )
      for (let c = a; c < b; c++) cells[c] = { ch: g[kind], hex }
    }
    let last = W - 1
    while (last >= 0 && !cells[last]) last--
    let bar = ''
    for (let c = 0; c <= last; c++) {
      bar += cells[c] ? paint(cells[c]!.ch, cells[c]!.hex ?? theme.fg) : ' '
    }
    const label = labels[i]!
    lines.push(
      (
        paint(label, theme.fg) +
        ' '.repeat(labelW - displayWidth(label) + 1) +
        bar
      ).trimEnd(),
    )
  })

  lines.push(axisLine(g.tickBottom), tickLabels.trimEnd())
  for (const v of verts) {
    lines.push(
      ' '.repeat(gutter + pointCol(v.start)) +
        paint(g.vert + ' ' + v.label, theme.fg),
    )
  }

  const legend = LEGEND.filter(([k]) => used.has(k)).map(
    ([k, name]) => `${paint(g[k], k === 'done' ? theme.line : accent)} ${name}`,
  )
  if (verts.length > 0) legend.push(`${paint(g.vert, theme.line)} marker`)
  if (legend.length > 0) lines.push('', '  ' + legend.join('  '))
  return lines.join('\n')
}
