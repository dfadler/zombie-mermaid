// ============================================================================
// ASCII renderer — Treemap
//
// Mermaid has no text mode for treemaps, so there is no reference output to
// match. The SVG packs nested rectangles by area, which does not survive a
// character grid, so this lists the tree: one row per node, children indented
// under their section with tree connectors, each with its total and a bar for
// its share of the whole treemap:
//
//   Products          2,100  ████████████████████▏
//   ├─ Electronics    1,400  █████████████▏
//   │  ├─ Phones        800  ███████▏
//   │  └─ Laptops       600  ██████
//   └─ Clothing         700  ██████▏
//   Services            200  ██
//
//   - Siblings are ordered by value, largest first, as in the SVG (ties keep
//     source order). A section's value is the sum of its leaves.
//   - A bar is the node's share of the grand total across 20 cells, at least
//     one cell for any positive value.
//   - A node with value 0 gets no bar. Values use Mermaid's default `,` format.
//   - Bars are painted in the theme accent. accTitle / accDescr are not
//     printed (see the pie renderer); the `title` is centred over the list.
// ============================================================================

import {
  formatTreemapValue,
  parseTreemap,
} from '@zombie-mermaid/mermaid-parser'
import type { TreemapNode } from '@zombie-mermaid/mermaid-parser'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'
import { colorizeText } from './ansi.ts'
import { displayWidth } from './display-width.ts'

/** Columns of a bar that is the whole treemap. */
const BAR = 20

const UNI = {
  mid: '├─ ',
  last: '└─ ',
  pipe: '│  ',
  blank: '   ',
  bar: '█',
  thin: '▏',
}
const ASC = {
  mid: '+- ',
  last: '`- ',
  pipe: '|  ',
  blank: '   ',
  bar: '#',
  thin: '|',
}

const pad = (s: string, w: number): string =>
  s + ' '.repeat(Math.max(0, w - displayWidth(s)))
const padStart = (s: string, w: number): string =>
  ' '.repeat(Math.max(0, w - displayWidth(s))) + s

interface Row {
  prefix: string
  name: string
  value: number
}

const total = (n: TreemapNode): number =>
  (n.value ?? 0) + (n.children ?? []).reduce((s, c) => s + total(c), 0)

export function renderTreemapAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const tm = parseTreemap(text)
  const g = config.useAscii ? ASC : UNI
  const paint = (s: string, hex: string): string =>
    colorizeText(s, hex, colorMode)
  const accent = theme.accent ?? theme.fg
  // A name is one line in the list.
  const one = (name: string): string => name.replace(/\s*\n\s*/g, ' ')

  const rows: Row[] = []
  const walk = (nodes: TreemapNode[], indent: string, top: boolean): void => {
    const sorted = nodes
      .map((n) => ({ n, v: total(n) }))
      .sort((a, b) => b.v - a.v)
    sorted.forEach(({ n, v }, i) => {
      const last = i === sorted.length - 1
      rows.push({
        prefix: top ? '' : indent + (last ? g.last : g.mid),
        name: one(n.name),
        value: v,
      })
      if (n.children) {
        walk(n.children, top ? '' : indent + (last ? g.blank : g.pipe), false)
      }
    })
  }
  walk(tm.roots, '', true)
  if (rows.length === 0) return tm.title ?? ''

  const grand = tm.roots.reduce((s, n) => s + total(n), 0)
  const nameWidth = Math.max(
    ...rows.map((r) => displayWidth(r.prefix + r.name)),
  )
  const valueWidth = Math.max(
    ...rows.map((r) => displayWidth(formatTreemapValue(r.value))),
  )
  let width = 0
  const lines = rows.map((r) => {
    const cells = grand > 0 ? (r.value / grand) * BAR : 0
    const whole = Math.floor(cells)
    // Solid blocks are their own run: html mode gives a pure run of them a
    // background, so adjacent cells join at fractional zoom (ascii-seams).
    const thin = r.value > 0 && (cells - whole >= 0.5 || whole === 0)
    const bar =
      paint(g.bar.repeat(whole), accent) + (thin ? paint(g.thin, accent) : '')
    width = Math.max(
      width,
      nameWidth +
        2 +
        valueWidth +
        (r.value > 0 ? 2 + whole + (thin ? 1 : 0) : 0),
    )
    return (
      paint(r.prefix, theme.arrow) +
      paint(pad(r.name, nameWidth - displayWidth(r.prefix)), theme.fg) +
      '  ' +
      paint(padStart(formatTreemapValue(r.value), valueWidth), theme.fg) +
      (r.value > 0 ? '  ' + bar : '')
    )
  })
  if (tm.title) {
    const left = Math.max(0, Math.floor((width - displayWidth(tm.title)) / 2))
    lines.unshift(' '.repeat(left) + paint(tm.title, theme.fg), '')
  }
  return lines.join('\n')
}
