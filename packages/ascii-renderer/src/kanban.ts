// ============================================================================
// ASCII renderer — Kanban
//
// Mermaid has no text mode for kanban boards, so there is no reference output
// to match. The SVG lays columns side by side, which at terminal widths would
// run off the screen after three or four columns, so this stacks them: one
// framed block per column, its heading centred over a rule, its cards boxed
// below:
//
//   ┌────────────────────────────┐
//   │            Todo            │
//   ├────────────────────────────┤
//   │ ┌────────────────────────┐ │
//   │ │ Create Documentation   │ │
//   │ └────────────────────────┘ │
//   │ ┌─ High ─────────────────┐ │
//   │ │ Create parsing tests   │ │
//   │ │ MC-2038   K.Sveidqvist │ │
//   │ └────────────────────────┘ │
//   └────────────────────────────┘
//
//   - Every column and card has the same width (the widest content, up to 40
//     columns; longer text wraps at word breaks).
//   - `priority` is named in the card's top border; `ticket` sits at the left of
//     a second row and `assigned` at its right.
//   - Markdown emphasis shows as plain text; icons and classes are not drawn.
//   - Headings are painted in the theme accent, frames in the line colour.
//   - Widths are display widths (CJK and emoji labels line up).
// ============================================================================

import { parseKanban, mindmapPlainLines } from '@zombie-mermaid/mermaid-parser'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'
import { colorizeText } from './ansi.ts'
import { displayWidth } from './display-width.ts'

/** Card text wraps at this many columns. */
const MAX_TEXT = 40

const UNI = {
  h: '─',
  v: '│',
  tl: '┌',
  tr: '┐',
  bl: '└',
  br: '┘',
  ml: '├',
  mr: '┤',
}
const ASC = {
  h: '-',
  v: '|',
  tl: '+',
  tr: '+',
  bl: '+',
  br: '+',
  ml: '+',
  mr: '+',
}

/** Greedy word wrap by display width; a word wider than `width` keeps its own line. */
function wrap(text: string): string[] {
  const out: string[] = []
  for (const line of mindmapPlainLines(text)) {
    let cur = ''
    for (const word of line.split(/\s+/).filter(Boolean)) {
      const next = cur ? `${cur} ${word}` : word
      if (cur && displayWidth(next) > MAX_TEXT) {
        out.push(cur)
        cur = word
      } else cur = next
    }
    out.push(cur)
  }
  return out
}

const pad = (s: string, n: number): string =>
  s + ' '.repeat(Math.max(0, n - displayWidth(s)))

export function renderKanbanAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const board = parseKanban(text)
  const g = config.useAscii ? ASC : UNI
  const paint = (s: string, hex: string): string =>
    colorizeText(s, hex, colorMode)
  const line = (s: string): string => paint(s, theme.line)
  const accent = theme.accent ?? theme.fg

  const cols = board.columns.map((c) => ({
    heading: wrap(c.text),
    cards: c.cards.map((card) => ({
      title: wrap(card.text),
      ticket: card.ticket ?? '',
      assigned: card.assigned ?? '',
      priority: card.priority ?? '',
    })),
  }))

  // Inner width of a card's text: the widest line anywhere.
  const widest = (ls: string[]) => Math.max(0, ...ls.map(displayWidth))
  let inner = 0
  for (const c of cols) {
    inner = Math.max(inner, widest(c.heading) - 6)
    for (const k of c.cards) {
      inner = Math.max(
        inner,
        widest(k.title),
        displayWidth(k.ticket) +
          (k.ticket && k.assigned ? 2 : 0) +
          displayWidth(k.assigned),
        displayWidth(k.priority) > 0 ? displayWidth(k.priority) + 2 : 0,
      )
    }
  }
  inner = Math.max(inner, 1)
  const colInner = inner + 4 // One space, the card's two borders, one space.
  const cardInner = inner + 2 // A space either side of the text.

  const blocks = cols.map((c) => {
    const rows: string[] = []
    rows.push(line(g.tl + g.h.repeat(colInner + 2) + g.tr))
    for (const h of c.heading) {
      const left = Math.floor((colInner + 2 - displayWidth(h)) / 2)
      rows.push(
        line(g.v) +
          ' '.repeat(left) +
          paint(h, accent) +
          ' '.repeat(colInner + 2 - displayWidth(h) - left) +
          line(g.v),
      )
    }
    const edge = (inside: string) => line(g.v) + ' ' + inside + ' ' + line(g.v)
    if (c.cards.length > 0) {
      rows.push(line(g.ml + g.h.repeat(colInner + 2) + g.mr))
    }
    for (const k of c.cards) {
      const top = k.priority
        ? g.h +
          ' ' +
          k.priority +
          ' ' +
          g.h.repeat(cardInner - displayWidth(k.priority) - 3)
        : g.h.repeat(cardInner)
      rows.push(edge(line(g.tl + top + g.tr)))
      const body = (s: string) =>
        edge(line(g.v) + ' ' + paint(pad(s, inner), theme.fg) + ' ' + line(g.v))
      for (const t of k.title) rows.push(body(t))
      if (k.ticket || k.assigned) {
        const gap = inner - displayWidth(k.ticket) - displayWidth(k.assigned)
        rows.push(body(k.ticket + ' '.repeat(gap) + k.assigned))
      }
      rows.push(edge(line(g.bl + g.h.repeat(cardInner) + g.br)))
    }
    rows.push(line(g.bl + g.h.repeat(colInner + 2) + g.br))
    return rows.join('\n')
  })
  return blocks.join('\n\n')
}
