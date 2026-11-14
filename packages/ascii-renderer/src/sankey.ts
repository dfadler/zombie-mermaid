// ============================================================================
// ASCII renderer — Sankey
//
// Mermaid has no text mode for sankey diagrams, so there is no reference
// output to match. The SVG is a set of ribbons between columns of bars, which
// does not survive a character grid, so this lists the flows: each source
// node once, with a row per outgoing link whose bar is that link's share of
// the largest flow:
//
//   Agricultural 'waste'  124.73
//     ├─▶ Bio-conversion  ████████████████████  124.73
//   Bio-conversion  310.78
//     ├─▶ Liquid          ▏                        0.6
//     ├─▶ Solid           ███▏                    26.86
//     └─▶ Gas             ████████████████████▏  280.32
//
//   - Sources are listed in order of first appearance, links in source order.
//   - A node's value is the larger of its incoming and outgoing totals, as in
//     the SVG, written with the diagram's `prefix` and `suffix`; `showValues:
//     false` leaves the node values and link values out.
//   - A sink with several inbound links gets a closing `name  total` row, as
//     its total would otherwise appear nowhere.
//   - A bar is at least one cell wide for any positive flow.
//   - Bars are painted in the theme accent. accTitle / accDescr are not
//     printed (see the pie renderer).
//
// Names are printable ASCII (Mermaid's lexer rejects the rest), so display
// widths equal string lengths; they are used anyway for alignment.
// ============================================================================

import { parseSankey } from '@zombie-mermaid/mermaid-parser'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'
import { colorizeText } from './ansi.ts'
import { displayWidth } from './display-width.ts'

/** Columns of the longest bar. */
const BAR = 20

const UNI = { mid: '├─▶', last: '└─▶', bar: '█', thin: '▏' }
const ASC = { mid: '+->', last: '`->', bar: '#', thin: '|' }

const pad = (s: string, w: number): string =>
  s + ' '.repeat(Math.max(0, w - displayWidth(s)))
const padStart = (s: string, w: number): string =>
  ' '.repeat(Math.max(0, w - displayWidth(s))) + s

export function renderSankeyAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const sk = parseSankey(text)
  const g = config.useAscii ? ASC : UNI
  const paint = (s: string, hex: string): string =>
    colorizeText(s, hex, colorMode)
  const accent = theme.accent ?? theme.fg
  const showValues = sk.config?.showValues ?? true
  const round = (v: number): number => {
    const r = Math.round(v * 100) / 100
    return Number.isFinite(r) ? r : v
  }
  const fmt = (v: number): string =>
    `${sk.config?.prefix ?? ''}${round(v)}${sk.config?.suffix ?? ''}`
  // A quoted name may span lines; a flow row stays on one.
  const one = (name: string): string => name.replace(/\s*\n\s*/g, ' ')

  const total = new Map<string, { out: number; in: number }>()
  for (const id of sk.nodes) total.set(id, { out: 0, in: 0 })
  for (const l of sk.links) {
    total.get(l.source)!.out += l.value
    total.get(l.target)!.in += l.value
  }
  const sources = sk.nodes.filter((id) => sk.links.some((l) => l.source === id))
  const maxFlow = Math.max(...sk.links.map((l) => l.value))
  const targetWidth = Math.max(
    ...sk.links.map((l) => displayWidth(one(l.target))),
  )
  const valueWidth = showValues
    ? Math.max(...sk.links.map((l) => displayWidth(fmt(l.value))))
    : 0

  const rows: string[] = []
  for (const id of sources) {
    const t = total.get(id)!
    rows.push(
      paint(one(id), theme.fg) +
        (showValues ? '  ' + paint(fmt(Math.max(t.in, t.out)), theme.fg) : ''),
    )
    const out = sk.links.filter((l) => l.source === id)
    out.forEach((l, i) => {
      const cells = maxFlow > 0 ? (l.value / maxFlow) * BAR : 0
      const whole = Math.floor(cells)
      // Solid blocks are their own run: html mode gives a pure run of them a
      // background, so adjacent cells join at fractional zoom (ascii-seams).
      const thin = l.value > 0 && (cells - whole >= 0.5 || whole === 0)
      const used = (l.value > 0 ? whole : 0) + (thin ? 1 : 0)
      const bar =
        paint(g.bar.repeat(l.value > 0 ? whole : 0), accent) +
        (thin ? paint(g.thin, accent) : '')
      const gap = showValues ? ' '.repeat(BAR + 1 - used) : ''
      rows.push(
        '  ' +
          paint(i === out.length - 1 ? g.last : g.mid, theme.arrow) +
          ' ' +
          paint(pad(one(l.target), targetWidth), theme.fg) +
          '  ' +
          bar +
          gap +
          (showValues
            ? '  ' + paint(padStart(fmt(l.value), valueWidth), theme.fg)
            : ''),
      )
    })
  }
  // A sink fed by several links has no row of its own, so its total (which
  // the SVG draws on the node) would appear nowhere; a single inbound link
  // already prints it.
  if (showValues) {
    for (const id of sk.nodes) {
      const t = total.get(id)!
      if (t.out === 0 && sk.links.filter((l) => l.target === id).length > 1) {
        rows.push(paint(one(id), theme.fg) + '  ' + paint(fmt(t.in), theme.fg))
      }
    }
  }
  return rows.join('\n')
}
