// ============================================================================
// ASCII renderer — Radar
//
// Mermaid has no text mode for radar charts, so there is no reference output
// to match. A radar's polar grid cannot be drawn legibly in a character grid,
// so this draws the same data as one group of bars per axis (one bar per
// curve), on a ruler with a mark for every ring of the graticule:
//
//             Grades
//
//                   0                                        100
//                   ├───┬───┬───┬───┬───┬───┬───┬───┬───┬───┤
//     Math    Alice ██████████████████████████████████······  85
//             Bob   ████████████████████████████············  70
//
//     Science Alice ...
//
//   - The ruler runs from `min` (left) to `max` (right, the largest entry
//     unless the diagram sets one) with a `┬` per ring. Each bar is filled by the same mapping as the SVG's radius:
//     the value clipped to [min, max]. The value is printed after the bar.
//   - A curve's fill glyph and colour follow its position in the source, as
//     `radarCurve-N` does. Curves are named in each group when `showLegend`
//     is on (the default); with `showLegend false` they are not, as in the
//     SVG.
//   - A curve with a different number of values than there are axes is not
//     drawn, as in Mermaid. `graticule polygon` and `circle` look the same.
//   - accTitle/accDescr are not printed (see the pie renderer). Widths are
//     display widths (CJK and emoji labels line up).
// ============================================================================

import {
  parseRadar,
  getSeriesColor,
  CHART_ACCENT_FALLBACK,
} from '@zombie-mermaid/mermaid-parser'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'
import { colorizeText } from './ansi.ts'
import { displayWidth } from './display-width.ts'

/** Bar width in cells, between the ruler's end marks. */
const BAR_WIDTH = 40
/** Mermaid's `cScale0..11` wraps after this many colours. */
const PALETTE_SIZE = 12

const UNI = {
  fills: ['█', '▓', '▒', '░'],
  track: '·',
  left: '├',
  right: '┤',
  tick: '┬',
  rule: '─',
}
const ASC = {
  fills: ['#', '=', '*', '+'],
  track: '.',
  left: '|',
  right: '|',
  tick: '+',
  rule: '-',
}

const pad = (s: string, width: number): string =>
  s + ' '.repeat(Math.max(0, width - displayWidth(s)))

export function renderRadarAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const radar = parseRadar(text)
  const g = config.useAscii ? ASC : UNI
  const paint = (s: string, hex: string): string =>
    colorizeText(s, hex, colorMode)
  const color = (index: number): string =>
    getSeriesColor(
      index % PALETTE_SIZE,
      theme.accent ?? CHART_ACCENT_FALLBACK,
      theme.bg,
    )

  const { axes, curves, options } = radar
  const drawn = curves
    .map((curve, index) => ({ curve, index }))
    .filter(({ curve }) => curve.entries.length === axes.length)
  const max =
    options.max ?? Math.max(...curves.map((c) => Math.max(...c.entries)))
  const min = options.min

  const rows: string[] = []
  // Widest row in columns, tracked apart from the text: colour modes wrap it in escapes or HTML.
  let width = 0
  if (axes.length > 0) {
    const axisWidth = Math.max(...axes.map((a) => displayWidth(a.label)))
    const nameWidth = options.showLegend
      ? Math.max(0, ...drawn.map(({ curve }) => displayWidth(curve.label)))
      : 0
    const head = ' '.repeat(2 + axisWidth + 1 + (nameWidth ? nameWidth + 1 : 0))

    const lo = String(min)
    const hi = String(max)
    // Ruler: a mark at min, one per ring up to max.
    const cells = Array.from({ length: BAR_WIDTH }, () => g.rule)
    for (let i = 0; i <= options.ticks; i++)
      cells[Math.round((i * (BAR_WIDTH - 1)) / options.ticks)] = g.tick
    cells[0] = g.left
    cells[BAR_WIDTH - 1] = g.right
    if (drawn.length > 0) {
      const gap = Math.max(1, BAR_WIDTH - lo.length - hi.length)
      rows.push(head + paint(lo + ' '.repeat(gap) + hi, theme.fg))
      rows.push(head + paint(cells.join(''), theme.line))
    }

    axes.forEach((axis, i) => {
      if (i > 0 && drawn.length > 1) rows.push('')
      const bars = drawn.map(({ curve, index }, k) => {
        // Clipped to [min, max] by the clamp; `|| 0` covers min == max.
        const filled = Math.round(
          (BAR_WIDTH * ((curve.entries[i] as number) - min)) / (max - min),
        )
        const n = Math.min(BAR_WIDTH, Math.max(0, filled || 0))
        const fill = g.fills[index % g.fills.length] as string
        return (
          '  ' +
          (k === 0
            ? paint(pad(axis.label, axisWidth), theme.fg)
            : ' '.repeat(axisWidth)) +
          ' ' +
          (nameWidth
            ? paint(pad(curve.label, nameWidth), theme.fg) + ' '
            : '') +
          paint(fill.repeat(n), color(index)) +
          paint(g.track.repeat(BAR_WIDTH - n), theme.line) +
          '  ' +
          paint(String(curve.entries[i]), theme.fg)
        )
      })
      if (bars.length === 0) rows.push('  ' + paint(axis.label, theme.fg))
      rows.push(...bars)
    })
    width =
      head.length +
      BAR_WIDTH +
      2 +
      Math.max(
        0,
        ...drawn.flatMap(({ curve }) =>
          curve.entries.map((e) => String(e).length),
        ),
      )
  }
  if (rows.length === 0) rows.push('(no axes)')

  const out: string[] = []
  if (radar.title) {
    const left = Math.max(
      0,
      Math.floor((width - displayWidth(radar.title)) / 2),
    )
    out.push(' '.repeat(left) + paint(radar.title, theme.fg), '')
  }
  return [...out, ...rows].join('\n')
}
