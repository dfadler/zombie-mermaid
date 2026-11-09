// ============================================================================
// ASCII renderer — User journey
//
// Mermaid has no text mode for journeys. The SVG puts each task in a column
// with a face at a height set by its score, which cannot survive a terminal,
// so this lists the same content row by row:
//
//        My working day
//
//   Actors: Cat, Me
//
//   [Go to work]
//     :)  5  Make tea       Me
//     :|  3  Go upstairs    Me
//     :(  1  Do work        Cat, Me
//
//   - A `[section]` heading precedes its tasks; tasks written before the first
//     section have none, as in Mermaid.
//   - The face follows Mermaid's rule: `:)` above 3, `:(` below 3, `:|` at 3
//     (and for a non-numeric score, which Mermaid draws as a straight mouth).
//   - Actors are listed once, sorted as Mermaid sorts them; each task row ends
//     with its own actors.
//   - Headings and faces are painted in the theme accent. accTitle / accDescr
//     are not printed (see the pie renderer).
//
// Widths are display widths (CJK and emoji labels line up).
// ============================================================================

import { parseJourney } from '@zombie-mermaid/mermaid-parser'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'
import { colorizeText } from './ansi.ts'
import { displayWidth } from './display-width.ts'

function face(score: number): string {
  return score > 3 ? ':)' : score < 3 ? ':(' : ':|'
}

export function renderJourneyAscii(
  text: string,
  _config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const j = parseJourney(text)
  const paint = (s: string, hex: string): string =>
    colorizeText(s, hex, colorMode)
  const accent = theme.accent ?? theme.line
  const indent = '  '

  const label = (n: string): string => n.replace(/<br\s*\/?>/gi, ' ')
  const nameWidth = Math.max(
    0,
    ...j.tasks.map((t) => displayWidth(label(t.name))),
  )
  const rows: string[] = []
  let width = 0
  const push = (plain: string, painted: string) => {
    width = Math.max(width, displayWidth(plain))
    rows.push(painted)
  }

  if (j.actors.length > 0) {
    const list = j.actors.map((a) => a || '(unnamed)').join(', ')
    push(
      `${indent}Actors: ${list}`,
      `${indent}${paint('Actors:', theme.fg)} ${paint(list, theme.fg)}`,
    )
    rows.push('')
  }
  let section: string | undefined
  for (const t of j.tasks) {
    if (t.section !== section) {
      section = t.section
      if (section !== '') {
        if (rows.length > 0 && rows[rows.length - 1] !== '') rows.push('')
        push(
          `${indent}[${section}]`,
          `${indent}${paint(`[${section}]`, accent)}`,
        )
      }
    }
    const score = Number.isNaN(t.score) ? '?' : String(t.score)
    const actors = t.actors.filter(Boolean).join(', ')
    const name = label(t.name)
    const pad = actors ? ' '.repeat(nameWidth - displayWidth(name)) : ''
    const plain = `${indent}${indent}${face(t.score)} ${score.padStart(2)}  ${name}${pad}${actors ? '  ' + actors : ''}`
    push(
      plain,
      `${indent}${indent}${paint(face(t.score), accent)} ${paint(score.padStart(2), theme.fg)}  ${paint(name, theme.fg)}${pad}${actors ? '  ' + paint(actors, theme.fg) : ''}`,
    )
  }
  while (rows.length > 0 && rows[rows.length - 1] === '') rows.pop()

  const out: string[] = []
  if (j.title) {
    const pad = Math.max(0, Math.floor((width - displayWidth(j.title)) / 2))
    out.push(' '.repeat(pad) + paint(j.title, theme.fg), '')
  }
  return [...out, ...rows].join('\n').trimEnd()
}
