// ============================================================================
// ASCII renderer — Ishikawa (fishbone)
//
// Mermaid has no text mode for ishikawa diagrams, so there is no reference
// output to match; this draws the SVG's shape (the same parse: a root effect,
// categories, and causes under them) as a fishbone on a character grid:
//
//        [ People ]
//   Training ───╲
//   └ Hiring ────╲        [ Process ]
//   Turnover ──────╲      Approval ──╲
//   ────────────────┴──────────┴──────►┌───────────────┐
//   Slow shipping ──╱                  │ Late delivery │
//   [ Materials ]                      └───────────────┘
//
//   - The effect is a box at the right end of the spine; categories alternate
//     above (`╲`) and below (`╱`) the spine, the first pair nearest the head,
//     as in Mermaid.
//   - Causes are listed in source order down each bone, each joined to it by
//     a leader line; a cause one level down gets a `└` and is indented.
//   - A `<br>` in a label is a space. Widths are display widths (CJK and
//     emoji labels line up).
//   - Borders and bones use the theme's line colour, labels its foreground.
//     accTitle / accDescr are not printed (see the pie renderer).
//
// Mermaid's `handDrawn` look, `diagramPadding` and `useMaxWidth` do not apply.
// ============================================================================

import { parseIshikawa } from '@zombie-mermaid/mermaid-parser'
import type { IshikawaNode } from '@zombie-mermaid/mermaid-parser'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'
import { colorizeText } from './ansi.ts'
import { displayWidth, toDisplayCells } from './display-width.ts'

const UNI = {
  h: '─',
  v: '│',
  up: '╲',
  down: '╱',
  tl: '┌',
  tr: '┐',
  bl: '└',
  br: '┘',
  tUp: '┴',
  tDown: '┬',
  arrow: '►',
  branch: '└',
} as const
const ASC = {
  h: '-',
  v: '|',
  up: '\\',
  down: '/',
  tl: '+',
  tr: '+',
  bl: '+',
  br: '+',
  tUp: '+',
  tDown: '+',
  arrow: '>',
  branch: '`',
} as const

/** Grid of cells, each with the colour it is painted in. */
class Grid {
  private cells: string[][] = []
  private tones: string[][] = []
  put(row: number, col: number, text: string, tone: string): void {
    while (this.cells.length <= row) {
      this.cells.push([])
      this.tones.push([])
    }
    const cs = this.cells[row]!
    const ts = this.tones[row]!
    let c = col
    for (const cell of toDisplayCells(text)) {
      while (cs.length <= c) {
        cs.push(' ')
        ts.push('')
      }
      cs[c] = cell
      ts[c] = tone
      c++
    }
  }
  render(mode: ColorMode): string {
    return this.cells
      .map((cs, r) => {
        let out = ''
        let run = ''
        let tone = ''
        const flush = () => {
          out += tone && run.trim() ? colorizeText(run, tone, mode) : run
          run = ''
        }
        for (const [i, cell] of cs.entries()) {
          if (this.tones[r]![i] !== tone) {
            flush()
            tone = this.tones[r]![i]!
          }
          run += cell
        }
        flush()
        return out.replace(/ +$/, '')
      })
      .join('\n')
  }
}

const oneLine = (text: string): string =>
  text
    .split(/<br\s*\/?>/)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

interface Row {
  text: string
  width: number
}

/** A category's causes in source order, a level down each indented. */
function causeRows(node: IshikawaNode, glyph: string): Row[] {
  const rows: Row[] = []
  const walk = (nodes: IshikawaNode[], depth: number): void => {
    for (const n of nodes) {
      const text =
        depth === 1
          ? oneLine(n.text)
          : `${'  '.repeat(depth - 2)}${glyph} ${oneLine(n.text)}`
      rows.push({ text, width: displayWidth(text) })
      walk(n.children, depth + 1)
    }
  }
  walk(node.children, 1)
  return rows
}

interface Block {
  node: IshikawaNode
  dir: -1 | 1
  rows: Row[]
  /** Bone rows. */
  h: number
  /** Column of the label centre. */
  c0: number
  /** Column the bone meets the spine. */
  spine: number
  width: number
  label: string
}

function planBlock(node: IshikawaNode, dir: -1 | 1, glyph: string): Block {
  const rows = causeRows(node, glyph)
  const h = Math.max(rows.length, 2)
  const label = `[ ${oneLine(node.text)} ]`
  const lw = displayWidth(label)
  let c0 = Math.floor(lw / 2)
  rows.forEach((r, i) => {
    // Upper bone: column c0+1+i on cause i; lower: c0+h-i. Leave a space and one leader cell.
    c0 = Math.max(c0, dir < 0 ? r.width + 1 - i : r.width + 2 - h + i)
  })
  const spine = c0 + h + 1
  const width = Math.max(spine + 1, c0 - Math.floor(lw / 2) + lw)
  return { node, dir, rows, h, c0, spine, width, label }
}

export function renderIshikawaAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const { root } = parseIshikawa(text)
  if (!root) return ''
  const g = config.useAscii ? ASC : UNI
  const blocks = root.children.map((n, i) =>
    planBlock(n, i % 2 === 0 ? -1 : 1, g.branch),
  )
  const upper = blocks.filter((b) => b.dir < 0)
  const lower = blocks.filter((b) => b.dir > 0)

  // Pairs run right to left from the head; each is as wide as its wider block, plus a gap.
  const pairs: Array<{ up?: Block; low?: Block; width: number }> = []
  for (let i = 0; i < Math.max(upper.length, lower.length); i++) {
    const up = upper[i]
    const low = lower[i]
    pairs.push({
      up,
      low,
      width: Math.max(up?.width ?? 0, low?.width ?? 0) + 2,
    })
  }
  const total = pairs.reduce((s, p) => s + p.width, 0)

  const head = oneLineList(root.text)
  const headW = Math.max(...head.map((l) => displayWidth(l))) + 2
  const upperH = Math.max(0, ...upper.map((b) => b.h + 1))
  const spineRow = Math.max(upperH, 1 + Math.floor(head.length / 2))

  const grid = new Grid()
  const line = theme.line
  const fg = theme.fg

  // Spine and head.
  const spineLeft = pairs.length ? 0 : total
  for (let x = spineLeft; x < total; x++) grid.put(spineRow, x, g.h, line)
  if (pairs.length) grid.put(spineRow, total, g.arrow, line)
  const hx = pairs.length ? total + 1 : 0
  const top = spineRow - 1 - Math.floor(head.length / 2)
  grid.put(top, hx, g.tl + g.h.repeat(headW) + g.tr, line)
  head.forEach((l, i) => {
    grid.put(top + 1 + i, hx, g.v, line)
    grid.put(top + 1 + i, hx + 1, ` ${l}`, fg)
    grid.put(top + 1 + i, hx + headW + 1, g.v, line)
  })
  grid.put(top + head.length + 1, hx, g.bl + g.h.repeat(headW) + g.br, line)

  let right = total
  for (const pair of pairs) {
    const x = right - pair.width
    right = x
    if (pair.up) {
      const b = pair.up
      const first = spineRow - 1 - b.h
      grid.put(
        first,
        x + b.c0 - Math.floor(displayWidth(b.label) / 2),
        b.label,
        fg,
      )
      for (let m = 0; m < b.h; m++) {
        const row = first + 1 + m
        const col = x + b.c0 + 1 + m
        const r = b.rows[m]
        if (r) {
          grid.put(row, x, r.text, fg)
          grid.put(
            row,
            x + r.width + 1,
            g.h.repeat(col - (x + r.width + 1)),
            line,
          )
        }
        grid.put(row, col, g.up, line)
      }
      grid.put(spineRow, x + b.spine, g.tUp, line)
    }
    if (pair.low) {
      const b = pair.low
      for (let m = 0; m < b.h; m++) {
        const row = spineRow + 1 + m
        const col = x + b.c0 + b.h - m
        const r = b.rows[m]
        if (r) {
          grid.put(row, x, r.text, fg)
          grid.put(
            row,
            x + r.width + 1,
            g.h.repeat(col - (x + r.width + 1)),
            line,
          )
        }
        grid.put(row, col, g.down, line)
      }
      grid.put(spineRow, x + b.spine, g.tDown, line)
      grid.put(
        spineRow + 1 + b.h,
        x + b.c0 - Math.floor(displayWidth(b.label) / 2),
        b.label,
        fg,
      )
    }
  }
  return grid.render(colorMode)
}

function oneLineList(text: string): string[] {
  return text.split(/<br\s*\/?>/).map((l) => l.replace(/\s+/g, ' ').trim())
}
