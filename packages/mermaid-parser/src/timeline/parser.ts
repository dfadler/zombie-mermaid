import { extractInitConfig, MermaidParseError } from '@zombie-mermaid/core'
import type { Timeline, TimelinePeriod } from './types.ts'

// ============================================================================
// Timeline parser
//
// A port of Mermaid's jison lexer and grammar (mermaid-js/mermaid
// packages/mermaid/src/diagrams/timeline/parser/timeline.jison and
// timelineDb.js, checked against mermaid@12.2.0 and 12.3.0, which are
// identical here):
//
//   timeline [LR | TD]
//   title <text>
//   section <name>
//   <period> [: <event>] [: <event>] ...
//   : <event>                          (more events for the last period)
//
// Rules taken from Mermaid:
//   - Rules are tried in the jison order at each position, first match wins.
//   - `#` starts a comment, also in the middle of a period: `C# Language`
//     is the period `C`. Inside an event a `#` is text.
//   - A period runs to the next `:`, `#` or newline. A `:` is an event
//     separator only when followed by whitespace, so `a:b` is an error.
//   - A `section` name stops at a `:` (the rest is an event).
//   - An event attaches to the last period written, whichever section that
//     was in; with no period yet Mermaid throws a TypeError, here a parse error.
//   - `timeline TB` is not a direction: `TB` becomes a period.
//   - Keywords are case-insensitive, the header is detected case-sensitively.
//
// Parsed from the raw text, not `Statement[]`: Mermaid's lexer does not treat
// `;` as a separator. accTitle/accDescr are stripped by `extractAccessibility`
// before the renderers call this; called directly, they are accepted and ignored.
// ============================================================================

type TokenKind =
  | 'SKIP'
  | 'HEADER_LR'
  | 'HEADER_TD'
  | 'HEADER'
  | 'TITLE'
  | 'SECTION'
  | 'PERIOD'
  | 'EVENT'
  | 'ACC'
  | 'INVALID'

/** Mermaid's lexer rules, in jison order (INITIAL state). */
const RULES: ReadonlyArray<readonly [TokenKind, RegExp]> = [
  ['SKIP', /%(?!\{)[^\n]*/y],
  ['SKIP', /[^}]%%[^\n]*/y],
  ['SKIP', /\s+/y],
  ['SKIP', /#[^\n]*/y],
  ['HEADER_LR', /timeline[ \t]+LR\b/iy],
  ['HEADER_TD', /timeline[ \t]+TD\b/iy],
  ['HEADER', /timeline\b/iy],
  ['TITLE', /title\s[^\n]+/iy],
  ['ACC', /accTitle\s*:[^\n]*/iy],
  ['ACC', /accDescr\s*:[^\n]*/iy],
  ['ACC', /accDescr\s*\{[^}]*\}/iy],
  ['SECTION', /section\s[^:\n]+/iy],
  ['EVENT', /:\s(?:[^:\n]|:(?!\s))+/y],
  ['PERIOD', /[^#:\n]+/y],
  ['INVALID', /[\s\S]/y],
]

const DIRECTIVE = /%%\{[\s\S]*?\}%%/g

function lineOf(text: string, pos: number): number {
  let line = 1
  for (let i = 0; i < pos; i++) if (text.charCodeAt(i) === 10) line++
  return line
}

/** Parse Mermaid `timeline` source into a typed {@link Timeline}. */
export function parseTimeline(text: string): Timeline {
  const source = text
    .replace(/\r\n?/g, '\n')
    // Directives are removed by Mermaid before lexing; keep their newlines so
    // error line numbers still match the caller's source.
    .replace(DIRECTIVE, (d) => d.replace(/[^\n]/g, ''))

  const timeline: Timeline = {
    direction: 'LR',
    sections: [],
    periods: [],
  }
  let currentSection = ''
  let sawHeader = false
  let pos = 0

  while (pos < source.length) {
    let kind: TokenKind = 'INVALID'
    let value = ''
    for (const [k, re] of RULES) {
      re.lastIndex = pos
      const m = re.exec(source)
      if (m) {
        kind = k
        value = m[0]
        break
      }
    }
    const at = pos
    pos += value.length
    if (kind === 'SKIP' || kind === 'ACC') continue

    const line = lineOf(source, at)
    if (!sawHeader) {
      if (kind === 'HEADER' || kind === 'HEADER_LR' || kind === 'HEADER_TD') {
        sawHeader = true
        if (kind === 'HEADER_TD') timeline.direction = 'TD'
        continue
      }
      throw new MermaidParseError(
        `Line ${line}: Expected the "timeline" header, found "${value.trim()}"`,
        { diagramType: 'timeline' },
      )
    }

    switch (kind) {
      case 'TITLE': {
        // Mermaid keeps everything after `title ` (substr(6)).
        const title = value.slice(6).trim()
        if (title) timeline.title = title
        else delete timeline.title
        break
      }
      case 'SECTION': {
        currentSection = value.slice(8).trim()
        timeline.sections.push(currentSection)
        break
      }
      case 'PERIOD': {
        const period: TimelinePeriod = {
          section: currentSection,
          label: value.trim(),
          events: [],
        }
        timeline.periods.push(period)
        break
      }
      case 'EVENT': {
        const last = timeline.periods[timeline.periods.length - 1]
        if (!last) {
          throw new MermaidParseError(
            `Line ${line}: An event ("${value.slice(2).trim()}") needs a period before it, for example "2004 : ${value.slice(2).trim()}"`,
            { diagramType: 'timeline' },
          )
        }
        last.events.push(value.slice(2).trim())
        break
      }
      default:
        throw new MermaidParseError(
          `Line ${line}: Unexpected "${value.trim() || value}" — a period is followed by ": <event>" (the colon needs a space after it), and "timeline" may only appear once as the header`,
          { diagramType: 'timeline' },
        )
    }
  }

  if (!sawHeader) {
    throw new MermaidParseError('Expected the "timeline" header', {
      diagramType: 'timeline',
    })
  }
  const init = extractInitConfig(text.split(/\r\n?|\n/))
  if (init.timeline) timeline.config = init.timeline
  return timeline
}
