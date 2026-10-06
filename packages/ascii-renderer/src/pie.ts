// ============================================================================
// ASCII renderer — Pie chart
//
// Mermaid has no text mode for pie charts, so there is no reference output to
// match. This renderer keeps lukilabs/beautiful-mermaid#151's design (one
// stacked bar plus a table) and takes its numbers from the SVG renderer
// (packages/svg-renderer/src/pie/layout.ts), so the two outputs agree:
//
//   Pets adopted by volunteers
//
//   [███████████████████████████████████████▓▓▓▓▓▓▓▓▓▒▒]
//
//     █ Dogs   79%
//     ▓ Cats   17%
//     ▒ Rats    3%
//
//   - The title, when there is one, is centred over the bar.
//   - The bar is BAR_WIDTH cells wide. Like the SVG pie, it holds only the
//     slices at or above 1% of the total, in source order, and those slices
//     share the whole bar between them. Cells are handed out by largest
//     remainder, so the segments always add up to exactly BAR_WIDTH. While
//     there are no more drawn slices than cells, every drawn slice gets at
//     least one cell; past that (more than 50 slices at 1% or more), the
//     ones that lose out on the rounding get none.
//   - The table is the SVG legend: one row per slice, omitted ones included,
//     in source order. The row text is the label, or `label [value]` with
//     `showData` (`String(value)`, no number formatting). The percentage is
//     the SVG's slice label: `toFixed(0)` of the share of the *whole* total.
//     A slice with no bar segment (under 1%, or left without a cell) has no
//     percentage, the way a slice left out of the SVG pie has no label.
//   - Colours are the SVG's: palette slot `index % 12` in source order, slot
//     0 the theme accent and the rest getSeriesColor() shades of it.
//   - Each bar segment gets a fill pattern, cycled by its position in the
//     bar so neighbours always differ, and its table swatch repeats it. This
//     holds in every colour mode, not only without colour: two neighbouring
//     palette shades can map to the same terminal colour (ansi16 has only a
//     handful that fit), and the fill keeps them apart. Colour is painted on
//     top. A slice with no segment gets a dot for its swatch.
//   - Labels are never truncated or wrapped: the table grows to the longest
//     one, as the SVG legend and the XY chart's category gutter do. Widths
//     are display widths, so CJK and emoji labels line up.
//   - accTitle/accDescr are not printed. In the SVG they are the accessible
//     name and description, not visible text.
// ============================================================================

import {
  parsePieChart,
  getSeriesColor,
  CHART_ACCENT_FALLBACK,
} from '@zombie-mermaid/mermaid-parser'
import type { PieChart } from '@zombie-mermaid/mermaid-parser'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'
import { colorizeText } from './ansi.ts'
import { displayWidth } from './display-width.ts'

/** Bar width in cells, between the brackets (as in #151). */
export const BAR_WIDTH = 50
/** Slices below this percentage of the total are not drawn (as in the SVG). */
const MIN_PERCENT = 1
/** Mermaid's pie1..pie12 scale wraps after this many colours. */
const PALETTE_SIZE = 12
/** Indent of the table rows. */
const TABLE_INDENT = '  '
/** Gap between the label column and the percentage column. */
const TABLE_GAP = '   '
/** Width of the percentage column ("100%"). */
const PERCENT_WIDTH = 4

/** `patterns` holds one fill character (all single UTF-16 units) per slot. */
const UNI = {
  patterns: '█▓▒░',
  noSegment: '·',
} as const

const ASC = {
  patterns: '#=*+',
  noSegment: '.',
} as const

/** One table row (one per parsed slice). */
export interface PieAsciiRow {
  /** Label, or `label [value]` with showData. */
  text: string
  /** Percentage text, or '' when the slice has no bar segment. */
  percentText: string
  /** Palette slot: source index modulo 12. */
  colorIndex: number
  /** Cells in the bar; 0 when the slice has no bar segment. */
  cells: number
  /** Position among the bar's segments, or -1 when the slice has none. */
  drawnIndex: number
}

export interface PieAsciiLayout {
  title?: string
  rows: PieAsciiRow[]
  barWidth: number
}

/**
 * Split `width` cells between `weights` by largest remainder, so the parts
 * add up to exactly `width`. When there are no more weights than cells,
 * every part gets at least one cell (taken from the parts furthest above
 * their exact share).
 */
export function allocateCells(weights: number[], width: number): number[] {
  const n = weights.length
  if (n === 0) return []
  const sum = weights.reduce((a, b) => a + b, 0)
  if (!(sum > 0)) return weights.map(() => 0)
  const parts = weights.map((w, i) => {
    const exact = (w / sum) * width
    return { i, exact, count: Math.floor(exact) }
  })
  let left = width - parts.reduce((a, p) => a + p.count, 0)
  // Largest remainder first; ties go to the earlier slice.
  const byRemainder = [...parts].sort(
    (a, b) => b.exact - b.count - (a.exact - a.count) || a.i - b.i,
  )
  for (const part of byRemainder) {
    if (left <= 0) break
    part.count++
    left--
  }
  if (n <= width) {
    // Give an empty part one cell, taken from whichever part is furthest
    // above its exact share and can spare one.
    for (const empty of parts) {
      if (empty.count !== 0) continue
      let donor: (typeof parts)[number] | undefined
      let best = -Infinity
      for (const part of parts) {
        const over = part.count - part.exact
        if (part.count > 1 && over > best) {
          best = over
          donor = part
        }
      }
      // Unreachable: with n <= width cells shared out and one part empty,
      // some other part holds at least two.
      /* v8 ignore next */
      if (donor === undefined) break
      donor.count--
      empty.count = 1
    }
  }
  return parts.map((p) => p.count)
}

/** Lay out a parsed pie chart for text output. Pure; no colours. */
export function layoutPieAscii(
  chart: PieChart,
  barWidth: number = BAR_WIDTH,
): PieAsciiLayout {
  const total = chart.slices.reduce((sum, s) => sum + s.value, 0)
  // Same filter as the SVG: a zero total gives NaN, which drops every slice.
  const drawn = chart.slices.flatMap((slice, index) =>
    (slice.value / total) * 100 >= MIN_PERCENT
      ? [{ index, value: slice.value }]
      : [],
  )
  const cells = allocateCells(
    drawn.map((d) => d.value),
    barWidth,
  )
  // Cells per source index; slices left out of the bar have no entry.
  const cellsBySlice = new Map(drawn.map((d, k) => [d.index, cells[k]]))

  // `segment` counts the slices that actually got cells, so fill patterns
  // cycle along the bar.
  let segment = 0
  const rows: PieAsciiRow[] = chart.slices.map((slice, index) => {
    const text = chart.showData
      ? `${slice.label} [${String(slice.value)}]`
      : slice.label
    const colorIndex = index % PALETTE_SIZE
    const sliceCells = cellsBySlice.get(index) ?? 0
    // A drawn slice can still end up with no cell when there are more drawn
    // slices than cells; it is shown like an omitted one, not as a segment.
    if (sliceCells === 0) {
      return { text, percentText: '', colorIndex, cells: 0, drawnIndex: -1 }
    }
    return {
      text,
      percentText: `${((slice.value / total) * 100).toFixed(0)}%`,
      colorIndex,
      cells: sliceCells,
      drawnIndex: segment++,
    }
  })

  return {
    title: chart.title && chart.title.length > 0 ? chart.title : undefined,
    rows,
    barWidth,
  }
}

/** Palette colour for slot `index`, as the SVG's pieColorValue() picks it. */
function sliceColor(index: number, theme: AsciiTheme): string {
  return getSeriesColor(index, theme.accent ?? CHART_ACCENT_FALLBACK, theme.bg)
}

export function renderPieAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const layout = layoutPieAscii(parsePieChart(text))
  const ch = config.useAscii ? ASC : UNI
  // colorizeText leaves an empty string (e.g. a `"" : 1` label) uncoloured.
  const paint = (s: string, hex: string): string =>
    colorizeText(s, hex, colorMode)

  // The same fill in every colour mode: colour alone can't keep neighbours
  // apart (see the header comment).
  const fill = (row: PieAsciiRow): string =>
    row.drawnIndex < 0
      ? ch.noSegment
      : ch.patterns.charAt(row.drawnIndex % ch.patterns.length)

  const lines: string[] = []
  const barLineWidth = layout.barWidth + 2

  if (layout.title !== undefined) {
    const pad = Math.max(
      0,
      Math.floor((barLineWidth - displayWidth(layout.title)) / 2),
    )
    lines.push(' '.repeat(pad) + paint(layout.title, theme.fg), '')
  }

  let bar = ''
  let used = 0
  for (const row of layout.rows) {
    if (row.cells <= 0) continue
    bar += paint(fill(row).repeat(row.cells), sliceColor(row.colorIndex, theme))
    used += row.cells
  }
  bar += ' '.repeat(Math.max(0, layout.barWidth - used))
  lines.push(paint('[', theme.border) + bar + paint(']', theme.border))

  if (layout.rows.length > 0) {
    lines.push('')
    const labelWidth = Math.max(...layout.rows.map((r) => displayWidth(r.text)))
    for (const row of layout.rows) {
      const swatch = paint(fill(row), sliceColor(row.colorIndex, theme))
      const label =
        paint(row.text, theme.fg) +
        ' '.repeat(labelWidth - displayWidth(row.text))
      const pct = paint(row.percentText.padStart(PERCENT_WIDTH), theme.fg)
      const line =
        row.percentText.length > 0
          ? `${TABLE_INDENT}${swatch} ${label}${TABLE_GAP}${pct}`
          : `${TABLE_INDENT}${swatch} ${paint(row.text, theme.fg)}`
      lines.push(line)
    }
  }

  return lines.join('\n')
}
