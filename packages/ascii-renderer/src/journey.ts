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

const UNNAMED = '(unnamed)'

function scoreText(score: number): string {
  return Number.isNaN(score) ? '?' : String(score)
}

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

  // Source text goes to the terminal as typed, so control characters (an
  // escape sequence in a title would clear the screen) are dropped first.
  const clean = (n: string): string =>
    n.replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
  const label = (n: string): string => clean(n.replace(/<br\s*\/?>/gi, ' '))
  let nameWidth = 0
  let scoreWidth = 2
  for (const t of j.tasks) {
    nameWidth = Math.max(nameWidth, displayWidth(label(t.name)))
    scoreWidth = Math.max(scoreWidth, scoreText(t.score).length)
  }
  const rows: string[] = []
  let width = 0
  const push = (plain: string, painted: string) => {
    width = Math.max(width, displayWidth(plain))
    rows.push(painted)
  }

  if (j.actors.length > 0) {
    const list = j.actors.map((a) => clean(a) || UNNAMED).join(', ')
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
          `${indent}[${clean(section)}]`,
          `${indent}${paint(`[${clean(section)}]`, accent)}`,
        )
      }
    }
    const score = scoreText(t.score).padStart(scoreWidth)
    const actors = t.actors.map((a) => clean(a) || UNNAMED).join(', ')
    const name = label(t.name)
    const pad = actors ? ' '.repeat(nameWidth - displayWidth(name)) : ''
    const plain = `${indent}${indent}${face(t.score)} ${score}  ${name}${pad}${actors ? '  ' + actors : ''}`
    push(
      plain,
      `${indent}${indent}${paint(face(t.score), accent)} ${paint(score, theme.fg)}  ${paint(name, theme.fg)}${pad}${actors ? '  ' + paint(actors, theme.fg) : ''}`,
    )
  }
  while (rows.length > 0 && rows[rows.length - 1] === '') rows.pop()

  const out: string[] = []
  if (j.title) {
    const title = clean(j.title)
    const pad = Math.max(0, Math.floor((width - displayWidth(title)) / 2))
    out.push(' '.repeat(pad) + paint(title, theme.fg), '')
  }
  return [...out, ...rows].join('\n').trimEnd()
}
