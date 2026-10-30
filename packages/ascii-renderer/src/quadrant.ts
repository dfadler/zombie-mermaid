// ============================================================================
// ASCII renderer — Quadrant chart
//
// Mermaid has no text mode for quadrant charts, so there is no reference
// output to match. This draws the SVG's picture on a character grid:
//
//                     Reach and engagement of campaigns
//
//                  ┌────────────────────────┬────────────────────────┐
//                  │    Need to promote     │    We should expand    │
//   High Engagement│         6              │                        │
//                  │ 1                      │        3               │
//                  ├────────────────────────┼────────────────────────┤
//   Low Engagement │      Re-evaluate       │    May be improved     │
//                  │         5      4       │             2          │
//                  └────────────────────────┴────────────────────────┘
//                     Low Reach                  High Reach
//
//     1 Campaign A  (0.3, 0.6)
//     ...
//
//   - Four equal cells with the SVG's quadrant order: 1 top right, 2 top
//     left, 3 bottom left, 4 bottom right. Cell width follows the longest
//     quadrant label (minimum 24 columns), height is 7 rows.
//   - A quadrant label is centred in its cell while the chart has no points
//     and sits on its top row once it has some, as in the SVG.
//   - A point is one marker character (1-9, A-Z, a-z, then `*`) at the cell
//     its coordinates fall on, in the point's own `color` when it has one and
//     the theme accent otherwise. Labels would overlap, so they go in a legend
//     below: marker, label and the coordinates as written. A marker that
//     would land on a quadrant label or another marker moves to the nearest
//     free cell, preferring downwards.
//   - Axis labels: the x labels under the two halves (start-aligned for a
//     one-sided axis), the y labels in a left gutter on the middle row of
//     each half (the bottom row for a one-sided axis).
//   - accTitle/accDescr are not printed (see the pie renderer).
//
// Cell and gutter widths are display widths (CJK and emoji labels line up).
// Emoji sequences that the terminal draws as one glyph but that span several
// code points are counted by `toDisplayCells`, like everywhere else here.
// ============================================================================

import { parseQuadrantChart } from '@zombie-mermaid/mermaid-parser'
import type { QuadrantChart } from '@zombie-mermaid/mermaid-parser'
import { parseHexColor } from '@zombie-mermaid/core'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'
import { colorizeText } from './ansi.ts'
import { displayWidth, toDisplayCells } from './display-width.ts'

/** Minimum cell width in columns. */
const MIN_CELL_WIDTH = 24
/** Cell height in rows. */
const CELL_HEIGHT = 7
const MARKERS = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const OVERFLOW_MARKER = '*'

const UNI = {
  h: '─',
  v: '│',
  tl: '┌',
  tr: '┐',
  bl: '└',
  br: '┘',
  t: '┬',
  b: '┴',
  l: '├',
  r: '┤',
  x: '┼',
}
const ASC = {
  h: '-',
  v: '|',
  tl: '+',
  tr: '+',
  bl: '+',
  br: '+',
  t: '+',
  b: '+',
  l: '+',
  r: '+',
  x: '+',
}

interface Cell {
  ch: string
  /** Hex colour; absent = the theme's border colour for frame cells. */
  hex?: string
}

function arrow(s: string, ascii: boolean): string {
  // U+27F6 is not in the mono font; `→` is.
  return s.replaceAll('⟶', ascii ? '->' : '→')
}

/** Marker character for the `i`th point (0-based). */
export function quadrantMarker(i: number): string {
  return MARKERS[i] ?? OVERFLOW_MARKER
}

export function renderQuadrantAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const chart: QuadrantChart = parseQuadrantChart(text)
  const ch = config.useAscii ? ASC : UNI
  const paint = (s: string, hex: string): string =>
    colorizeText(s, hex, colorMode)

  const hasPoints = chart.points.length > 0
  const quadrantText = chart.quadrants.map((q) => arrow(q, config.useAscii))
  const W = Math.max(
    MIN_CELL_WIDTH,
    ...quadrantText.map((q) => displayWidth(q) + 2),
  )
  const H = CELL_HEIGHT
  const gridW = 2 * W + 3
  const gridH = 2 * H + 3
  // The divider column.
  const mid = W + 1
  const midRow = H + 1

  const grid: (Cell | undefined)[][] = Array.from({ length: gridH }, () =>
    new Array<Cell | undefined>(gridW).fill(undefined),
  )
  const frame = (r: number, c: number, s: string) => {
    grid[r]![c] = { ch: s, hex: theme.border }
  }
  for (let c = 0; c < gridW; c++) {
    for (const r of [0, midRow, gridH - 1]) frame(r, c, ch.h)
  }
  for (let r = 0; r < gridH; r++) {
    for (const c of [0, mid, gridW - 1]) frame(r, c, ch.v)
  }
  frame(0, 0, ch.tl)
  frame(0, mid, ch.t)
  frame(0, gridW - 1, ch.tr)
  frame(midRow, 0, ch.l)
  frame(midRow, mid, ch.x)
  frame(midRow, gridW - 1, ch.r)
  frame(gridH - 1, 0, ch.bl)
  frame(gridH - 1, mid, ch.b)
  frame(gridH - 1, gridW - 1, ch.br)

  // Text placed on the grid is reserved: markers keep off it.
  const reserved = new Set<string>()
  const put = (row: number, col: number, s: string, hex: string) => {
    toDisplayCells(s).forEach((c, k) => {
      grid[row]![col + k] = { ch: c, hex }
      reserved.add(`${row},${col + k}`)
    })
  }

  // Quadrant 1 is top right, 2 top left, 3 bottom left, 4 bottom right.
  const origins = [
    [1, mid + 1],
    [1, 1],
    [midRow + 1, 1],
    [midRow + 1, mid + 1],
  ] as const
  quadrantText.forEach((q, i) => {
    if (!q) return
    const [top, left] = origins[i]!
    const row = hasPoints ? top : top + Math.floor((H - 1) / 2)
    put(row, left + Math.floor((W - displayWidth(q)) / 2), q, theme.fg)
  })

  // Markers, nearest free cell first (down before up, then left/right).
  const offsets: [number, number][] = []
  for (let d = 0; d <= 6; d++) {
    for (let dy = 0; dy <= d; dy++) {
      for (const sy of dy === 0 ? [1] : [1, -1]) {
        const dx = d - dy
        for (const sx of dx === 0 ? [1] : [1, -1]) {
          offsets.push([sy * dy, sx * dx])
        }
      }
    }
  }
  chart.points.forEach((p, i) => {
    const r0 = 1 + Math.round((1 - p.y) * (2 * H))
    const c0 = 1 + Math.round(p.x * (2 * W))
    const free = (r: number, c: number) =>
      r >= 1 &&
      r <= 2 * H + 1 &&
      c >= 1 &&
      c <= 2 * W + 1 &&
      !reserved.has(`${r},${c}`)
    const [dr, dc] = offsets.find(([a, b]) => free(r0 + a, c0 + b)) ?? [0, 0]
    // Ponytail: a fully crowded neighbourhood (radius 6) overwrites the
    // point's own cell; widen the offset table if charts that dense matter.
    const r = r0 + dr
    const c = c0 + dc
    grid[r]![c] = {
      ch: quadrantMarker(i),
      hex:
        p.color && parseHexColor(p.color)
          ? p.color
          : (theme.accent ?? theme.fg),
    }
    reserved.add(`${r},${c}`)
  })

  // Gutter with the y labels.
  const yTwo = chart.yAxisTop !== undefined
  const yLabels: { row: number; text: string }[] = []
  if (chart.yAxisTop) {
    yLabels.push({
      row: Math.floor(H / 2) + 1,
      text: arrow(chart.yAxisTop, config.useAscii),
    })
  }
  if (chart.yAxisBottom) {
    yLabels.push({
      row: yTwo ? midRow + Math.floor(H / 2) + 1 : 2 * H + 1,
      text: arrow(chart.yAxisBottom, config.useAscii),
    })
  }
  const gutter = yLabels.length
    ? Math.max(...yLabels.map((l) => displayWidth(l.text))) + 1
    : 0
  const yByRow = new Map(yLabels.map((l) => [l.row, l.text]))

  const render = (r: number): string => {
    let line = ''
    const label = yByRow.get(r)
    if (gutter > 0) {
      line +=
        ' '.repeat(gutter - 1 - (label ? displayWidth(label) : 0)) +
        (label ? paint(label, theme.fg) : '') +
        ' '
    }
    for (const cell of grid[r]!) {
      line += cell ? paint(cell.ch, cell.hex ?? theme.fg) : ' '
    }
    return line.replace(/\s+$/, '')
  }

  const lines: string[] = []
  const fullWidth = gutter + gridW
  if (chart.title) {
    const pad = Math.max(
      0,
      Math.floor((fullWidth - displayWidth(chart.title)) / 2),
    )
    lines.push(' '.repeat(pad) + paint(chart.title, theme.fg), '')
  }
  for (let r = 0; r < gridH; r++) lines.push(render(r))

  // The x labels, under the halves.
  if (chart.xAxisLeft || chart.xAxisRight) {
    const xTwo = chart.xAxisRight !== undefined
    const row: string[] = []
    let col = 0
    const emit = (s: string, start: number) => {
      const t = arrow(s, config.useAscii)
      row.push(' '.repeat(Math.max(0, start - col)) + paint(t, theme.fg))
      col = Math.max(col, start) + displayWidth(t)
    }
    if (xTwo) {
      const centre = (s: string, c0: number) =>
        c0 + 1 + Math.floor((W - displayWidth(arrow(s, config.useAscii))) / 2)
      if (chart.xAxisLeft)
        emit(chart.xAxisLeft, gutter + centre(chart.xAxisLeft, 0))
      emit(chart.xAxisRight!, gutter + centre(chart.xAxisRight!, mid))
    } else if (chart.xAxisLeft) {
      emit(chart.xAxisLeft, gutter + 1)
    }
    lines.push(row.join(''))
  }

  if (hasPoints) {
    lines.push('')
    const width = Math.max(
      ...chart.points.map((_, i) => quadrantMarker(i).length),
    )
    const labelWidth = Math.max(
      ...chart.points.map((p) => displayWidth(p.label)),
    )
    chart.points.forEach((p, i) => {
      const hex =
        p.color && parseHexColor(p.color) ? p.color : (theme.accent ?? theme.fg)
      const marker = paint(quadrantMarker(i).padEnd(width), hex)
      const label =
        paint(p.label, theme.fg) +
        ' '.repeat(labelWidth - displayWidth(p.label))
      lines.push(`  ${marker} ${label}  (${p.x}, ${p.y})`)
    })
  }

  return lines.join('\n')
}
