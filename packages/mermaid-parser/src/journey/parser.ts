import { MermaidParseError } from '@zombie-mermaid/core'
import type { Journey } from './types.ts'

// ============================================================================
// Journey parser
//
// A port of Mermaid's jison lexer and grammar (mermaid-js/mermaid
// packages/mermaid/src/diagrams/user-journey/parser/journey.jison and
// journeyDb.js, read from mermaid@12.3.0):
//
//   journey
//   title <text>
//   section <name>
//   <task> : <score> [: <actor>, <actor> ...]
//
// Rules taken from Mermaid:
//   - Rules are tried in the jison order at each position, first match wins.
//   - `#` starts a comment (also mid-line) and `;` is not a separator: a `;`
//     in a task name, title or section is a syntax error, as is a task with no
//     `: score`.
//   - A task name runs to the next `:`, `#`, `;` or newline; the score data
//     runs to the next `#`, `;` or newline. `Number()` of the first
//     `:`-separated piece is the score (NaN when not numeric); the second
//     piece, split on `,`, is the actor list. Further pieces are ignored.
//   - Keywords are case-insensitive. `journey` may appear once, first.
//   - Actors are listed sorted with `Array.sort()` (UTF-16 order).
//
// Parsed from the raw text, not `Statement[]`, because of the `;` rule.
// ============================================================================

type TokenKind =
  | 'SKIP'
  | 'NEWLINE'
  | 'HEADER'
  | 'TITLE'
  | 'SECTION'
  | 'TASK_DATA'
  | 'TASK_NAME'
  | 'ACC'
  | 'INVALID'

/** Mermaid's lexer rules, in jison order (INITIAL state). */
const RULES: ReadonlyArray<readonly [TokenKind, RegExp]> = [
  ['SKIP', /%(?!\{)[^\n]*/y],
  ['SKIP', /[^}]%%[^\n]*/y],
  ['NEWLINE', /\n+/y],
  ['SKIP', /\s+/y],
  ['SKIP', /#[^\n]*/y],
  ['HEADER', /journey\b/iy],
  ['TITLE', /title\s[^#\n;]+/iy],
  ['ACC', /accTitle\s*:[^\n]*/iy],
  ['ACC', /accDescr\s*:[^\n]*/iy],
  ['ACC', /accDescr\s*\{[^}]*\}/iy],
  ['SECTION', /section\s[^#:\n;]+/iy],
  ['TASK_NAME', /[^#:\n;]+/y],
  ['TASK_DATA', /:[^#\n;]+/y],
]

const DIRECTIVE = /%%\{[\s\S]*?\}%%/g

/** Parse Mermaid `journey` source into a typed {@link Journey}. */
export function parseJourney(text: string): Journey {
  const source = text
    .replace(/\r\n?/g, '\n')
    // Directives are removed by Mermaid before lexing; keep their newlines so
    // error line numbers still match the caller's source.
    .replace(DIRECTIVE, (d) => d.replace(/[^\n]/g, ''))

  const journey: Journey = { sections: [], tasks: [], actors: [] }
  let currentSection = ''
  let sawHeader = false
  let pendingName: { name: string; line: number } | undefined
  let pos = 0
  let tokenLine = 1

  const fail = (line: number, msg: string): never => {
    throw new MermaidParseError(`Line ${line}: ${msg}`, {
      diagramType: 'journey',
    })
  }

  while (pos < source.length) {
    let kind: TokenKind = 'INVALID'
    let value = source[pos]!
    for (const [k, re] of RULES) {
      re.lastIndex = pos
      const m = re.exec(source)
      if (m) {
        kind = k
        value = m[0]
        break
      }
    }
    // Count the newlines this token spans as it is consumed, so a token's
    // line is known without rescanning the source from the start.
    const line = tokenLine
    for (let i = 0; i < value.length; i++)
      if (value.charCodeAt(i) === 10) tokenLine++
    pos += value.length
    if (kind === 'SKIP' || kind === 'ACC') continue
    if (kind === 'NEWLINE') {
      // A task name must be followed by its `: score` on the same line.
      if (pendingName) {
        fail(
          pendingName.line,
          `The task "${pendingName.name}" needs a score on the same line, for example "${pendingName.name}: 5: Me"`,
        )
      }
      continue
    }

    if (!sawHeader) {
      if (kind === 'HEADER') {
        sawHeader = true
        continue
      }
      fail(line, `Expected the "journey" header, found "${value.trim()}"`)
    }
    if (pendingName && kind !== 'TASK_DATA') {
      fail(
        pendingName.line,
        `The task "${pendingName.name}" needs a score, for example "${pendingName.name}: 5: Me"`,
      )
    }

    switch (kind) {
      case 'TITLE': {
        // Mermaid keeps everything after `title ` (substr(6)).
        const title = value.slice(6).trim()
        if (title) journey.title = title
        else delete journey.title
        break
      }
      case 'SECTION': {
        currentSection = value.slice(8).trim()
        journey.sections.push(currentSection)
        break
      }
      case 'TASK_NAME':
        pendingName = { name: value.trim(), line }
        break
      case 'TASK_DATA': {
        if (!pendingName) {
          fail(
            line,
            `Unexpected "${value.trim()}" — a score follows a task name`,
          )
        }
        const pieces = value.slice(1).split(':')
        journey.tasks.push({
          section: currentSection,
          name: pendingName!.name,
          score: Number(pieces[0]),
          actors:
            pieces.length === 1
              ? []
              : pieces[1]!.split(',').map((s) => s.trim()),
        })
        pendingName = undefined
        break
      }
      default:
        fail(
          line,
          `Unexpected "${value.trim() || value}" — "journey" may only appear once, as the header, and ";" is not allowed`,
        )
    }
  }

  if (!sawHeader) {
    throw new MermaidParseError('Expected the "journey" header', {
      diagramType: 'journey',
    })
  }
  if (pendingName) {
    fail(
      pendingName.line,
      `The task "${pendingName.name}" needs a score, for example "${pendingName.name}: 5: Me"`,
    )
  }
  journey.actors = [...new Set(journey.tasks.flatMap((t) => t.actors))].sort()
  return journey
}
