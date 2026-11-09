// ============================================================================
// ASCII renderer — Packet
//
// Mermaid has no text mode for packet diagrams, so there is no reference
// output to match; this draws the SVG's content (the same rows, from the same
// parse: `Packet.words`, `bitsPerRow`, `bitOrder`, `showBits`) as a grid of
// boxes, one bit per `bitCols` columns:
//
//          TCP Packet
//     ┌───────────────┬───────────────┐
//     │0           15 │16          31 │
//     │  Source Port  │ Destination   │
//     ├───────────────┴───────────────┤
//     │32                          63 │
//     │        Sequence Number        │
//     └───────────────────────────────┘
//
//   - Each field is a box; boxes share their borders, and a row that is not
//     full ends where its last field does.
//   - The first line of a box holds its bit numbers (start left, end right; a
//     one-bit box shows its number alone, a box too narrow for both shows the
//     start), the second its label, centred. A label wider than its box is cut
//     with `…` (`~` in ASCII mode). With `showBits: false` only the label line.
//   - `bitOrder: descending` mirrors each row, high bit on the left.
//   - Rows hold `bitsPerRow` bits (32); a field crossing a row repeats per row.
//   - A box is `bitCols` columns per bit: 2, or more when a label needs the room
//     and the row stays within 120 columns (a 32-bit row gets at most 3).
//   - Borders use the theme's line colour, labels its foreground. accTitle /
//     accDescr are not printed (see the pie renderer).
//
// Widths are display widths (CJK and emoji labels line up).
// ============================================================================

import {
  parsePacket,
  resolvePacketConfig,
} from '@zombie-mermaid/mermaid-parser'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'
import { colorizeText } from './ansi.ts'
import { displayWidth, toDisplayCells } from './display-width.ts'

/** Rows grow past 2 columns a bit only while they stay within this many columns. */
const MAX_WIDTH = 120

const UNI = { h: '─', v: '│', ellipsis: '…' } as const
const ASC = { h: '-', v: '|', ellipsis: '~' } as const

/** Unicode box-drawing glyph for the arms present at a grid point. */
function joint(
  up: boolean,
  down: boolean,
  left: boolean,
  right: boolean,
  ascii: boolean,
): string {
  if (!(up || down || left || right)) return ' '
  if (ascii) return up || down ? (left || right ? '+' : '|') : '-'
  const key = (up ? 8 : 0) | (down ? 4 : 0) | (left ? 2 : 0) | (right ? 1 : 0)
  return (
    {
      1: '─',
      2: '─',
      3: '─',
      4: '│',
      5: '┌',
      6: '┐',
      7: '┬',
      8: '│',
      9: '└',
      10: '┘',
      11: '┴',
      12: '│',
      13: '├',
      14: '┤',
      15: '┼',
    } as Record<number, string>
  )[key]!
}

/** A line of grid cells, each with the colour it is painted in. */
class Line {
  cells: string[] = []
  tones: string[] = []
  put(col: number, text: string, tone: string): void {
    let c = col
    for (const cell of toDisplayCells(text)) {
      while (this.cells.length <= c) {
        this.cells.push(' ')
        this.tones.push('')
      }
      this.cells[c] = cell
      this.tones[c] = tone
      c++
    }
  }
  render(mode: ColorMode): string {
    let out = ''
    let run = ''
    let tone = ''
    const flush = () => {
      out += tone && run.trim() ? colorizeText(run, tone, mode) : run
      run = ''
    }
    for (const [i, cell] of this.cells.entries()) {
      if (this.tones[i] !== tone) {
        flush()
        tone = this.tones[i]!
      }
      run += cell
    }
    flush()
    return out.replace(/ +$/, '')
  }
}

/** Cut `text` to `width` columns, ending in the ellipsis when it was cut. */
function fit(text: string, width: number, ellipsis: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (displayWidth(flat) <= width) return flat
  let out = ''
  for (const cell of toDisplayCells(flat)) {
    if (displayWidth(out + cell) > width - 1) break
    out += cell
  }
  return out + ellipsis
}

export function renderPacketAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const packet = parsePacket(text)
  if (packet.words.length === 0) return packet.title ?? ''
  const cfg = resolvePacketConfig(packet.config)
  const { bitsPerRow, showBits } = cfg
  const descending = cfg.bitOrder === 'descending'
  const g = config.useAscii ? ASC : UNI
  // Widest label (with a space each side) over the fewest bits it spans, so
  // labels fit when the row stays within MAX_WIDTH columns; 2 columns a bit at least.
  let need = 2
  for (const b of packet.words.flat())
    need = Math.max(
      need,
      Math.ceil((displayWidth(b.label) + 3) / (b.end - b.start + 1)),
    )
  const bitCols = Math.min(
    need,
    Math.max(2, Math.floor(MAX_WIDTH / bitsPerRow)),
  )
  const total = bitsPerRow * bitCols

  // Per row: the boxes as [left, right] grid columns (shared borders).
  const rows = packet.words.map((word) =>
    word.map((b) => {
      const bits = b.end - b.start + 1
      const first = b.start % bitsPerRow
      const col = descending ? bitsPerRow - first - bits : first
      return { b, bits, x0: col * bitCols, x1: (col + bits) * bitCols }
    }),
  )

  const out: string[] = []
  const border = (
    above: (typeof rows)[number] | undefined,
    below: (typeof rows)[number] | undefined,
  ): string => {
    const line = new Line()
    const covers = (r: typeof above, a: number, b: number): boolean =>
      !!r?.some((s) => s.x0 <= a && b <= s.x1)
    const edge = (r: typeof above, x: number): boolean =>
      !!r?.some((s) => s.x0 === x || s.x1 === x)
    for (let x = 0; x <= total; x++) {
      const left = x > 0 && (covers(above, x - 1, x) || covers(below, x - 1, x))
      const right =
        x < total && (covers(above, x, x + 1) || covers(below, x, x + 1))
      line.put(
        x,
        joint(edge(above, x), edge(below, x), left, right, config.useAscii),
        theme.line,
      )
    }
    return line.render(colorMode)
  }

  rows.forEach((row, i) => {
    out.push(border(rows[i - 1], row))
    const lines = showBits ? [new Line(), new Line()] : [new Line()]
    for (const { b, bits, x0, x1 } of row) {
      const iw = x1 - x0 - 1
      for (const l of lines) {
        l.put(x0, g.v, theme.line)
        l.put(x1, g.v, theme.line)
      }
      const label = fit(b.label, iw, g.ellipsis)
      const labelLine = lines[lines.length - 1]!
      labelLine.put(
        x0 + 1 + Math.floor((iw - displayWidth(label)) / 2),
        label,
        theme.fg,
      )
      if (showBits) {
        const [lead, trail] = descending ? [b.end, b.start] : [b.start, b.end]
        const s = String(lead)
        const e = String(trail)
        if (bits === 1) {
          if (s.length <= iw)
            lines[0]!.put(
              x0 + 1 + Math.floor((iw - s.length) / 2),
              s,
              theme.line,
            )
        } else if (s.length + 1 + e.length <= iw) {
          lines[0]!.put(x0 + 1, s, theme.line)
          lines[0]!.put(x1 - e.length, e, theme.line)
        } else if (s.length <= iw) lines[0]!.put(x0 + 1, s, theme.line)
      }
    }
    for (const l of lines) out.push(l.render(colorMode))
  })
  out.push(border(rows[rows.length - 1], undefined))

  if (packet.title) {
    const pad = Math.max(
      0,
      Math.floor((total + 1 - displayWidth(packet.title)) / 2),
    )
    out.unshift(
      ' '.repeat(pad) + colorizeText(packet.title, theme.fg, colorMode),
    )
  }
  return out.join('\n')
}
