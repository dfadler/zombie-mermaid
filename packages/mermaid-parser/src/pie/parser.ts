import type { PieChart, PieSlice } from './types.ts'

// ============================================================================
// Pie chart parser
//
// Parses Mermaid `pie` syntax into a typed PieChart, matching what Mermaid
// itself accepts and rejects. Mermaid parses pie charts with a Langium
// grammar (mermaid-js/mermaid packages/parser/src/language/pie/pie.langium
// plus common/common.langium) and then validates slices in pieDb.ts. This
// file is a small hand-written lexer + recursive-descent parser over the same
// token patterns, so the accepted language is the same:
//
//   pie [showData] [title <text> | accTitle: <text> | accDescr …]
//   title <text>                       (own line; rest of line, unquoted)
//   accTitle: <text>
//   accDescr: <text>
//   accDescr { <multi-line text> }
//   "Label" : 42.5                     (or 'Label'; label MUST be quoted)
//
// Mermaid's rules, each mirrored below:
//   - `showData` is only valid directly after `pie`; a `showData` line on
//     its own is a syntax error.
//   - Numbers are `-?\d+\.\d+` or `-?(0|[1-9]\d*)` — no `+`, no exponent,
//     no leading `.`, no trailing `.`.
//   - Everything after a complete statement on the same line (other than a
//     `%%` comment) is a syntax error.
//   - A negative value is an error (pieDb.addSection), reported only once
//     the whole chart has parsed, and before the duplicate-label check.
//   - A zero value is accepted.
//   - A repeated label keeps its first value; later ones are ignored.
//   - A chart with no slices (a bare `pie`) is valid.
//   - `title`/`accTitle`/`accDescr` may repeat; the last one wins, and an
//     empty one counts as unset.
//   - Keywords are case-sensitive (`Pie`, `showdata`, `Title` are errors).
//
// Why raw text and not `Statement[]` like the other mermaid-parser parsers:
// `splitStatements` splits on `;` and treats `'` as a quote when looking for
// `%%`, neither of which Mermaid's pie grammar does — `title A; B` is one
// title there, and a quoted label may even span lines. Lexing the source
// directly keeps those cases identical to Mermaid. The SVG registry's
// `parse(lines, text)` already hands every parser the raw text too.
//
// Earlier ports: lukilabs/beautiful-mermaid#151 (birenroy) — the starting
// point for the model and tests — and #150 (Daniele-rolli), whose parser
// rejected unknown lines instead of dropping them.
// ============================================================================

type TokenKind =
  | 'NEWLINE'
  | 'PIE'
  | 'SHOW_DATA'
  | 'COLON'
  | 'NUMBER'
  | 'STRING'
  | 'TITLE'
  | 'ACC_TITLE'
  | 'ACC_DESCR'

interface Token {
  kind: TokenKind
  text: string
  /** 1-based source line the token starts on. */
  line: number
}

/**
 * Token patterns in Langium's lexing order: whitespace first, then
 * keywords (longest first), then terminals. `null` kinds are hidden (skipped).
 * Each is sticky so it only matches at the current position.
 *
 * `pie`/`showData` carry the `(?:(?=%%)|(?!\S))` suffix Mermaid's
 * `AbstractMermaidTokenBuilder` adds: the keyword must be followed by
 * whitespace, a comment, or the end of the text.
 */
const TOKEN_PATTERNS: ReadonlyArray<readonly [TokenKind | null, RegExp]> = [
  [null, /[\t ]+/y],
  ['SHOW_DATA', /showData(?:(?=%%)|(?!\S))/y],
  ['PIE', /pie(?:(?=%%)|(?!\S))/y],
  ['COLON', /:/y],
  ['NUMBER', /-?[0-9]+\.[0-9]+(?!\.)|-?(?:0|[1-9][0-9]*)(?!\.)/y],
  [
    'ACC_DESCR',
    /[\t ]*accDescr(?:[\t ]*:(?:[^\n\r]*?(?=%%)|[^\n\r]*)|\s*\{[^}]*\})/y,
  ],
  ['ACC_TITLE', /[\t ]*accTitle[\t ]*:(?:[^\n\r]*?(?=%%)|[^\n\r]*)/y],
  ['TITLE', /[\t ]*title(?:[\t ][^\n\r]*?(?=%%)|[\t ][^\n\r]*|)/y],
  ['STRING', /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/y],
  ['NEWLINE', /\n/y],
  [null, /[\t ]*%%[^\n\r]*/y],
]

/** Mermaid's `directiveRegex` (diagram-api/regexes.ts), verbatim. */
const DIRECTIVE_REGEX =
  /%{2}{\s*(?:(\w+)\s*:|(\w+))\s*(?:(\w+)|((?:(?!}%{2}).|\r?\n)*))?\s*(?:}%{2})?/gi

/** Value extractors from Mermaid's common/matcher.ts. */
const ACC_DESCR_VALUE = /accDescr(?:[\t ]*:([^\n\r]*)|\s*\{([^}]*)\})/
const ACC_TITLE_VALUE = /accTitle[\t ]*:([^\n\r]*)/
const TITLE_VALUE = /title([\t ][^\n\r]*|)/

const SYNTAX_HELP =
  'A pie chart is `pie [showData] [title <text>]` followed by lines of `"Label" : value` (label quoted with " or \'), `title <text>`, `accTitle: <text>`, or `accDescr: <text>`.'

/**
 * Mirror Mermaid's text preprocessing (preprocess.ts `cleanupText` and
 * `removeDirectives`) that runs before the grammar sees the source:
 *   - CRLF / lone CR become LF;
 *   - double-quoted attributes inside HTML-like tags become single-quoted;
 *   - `%%{ … }%%` directives are removed. Unlike Mermaid, the newlines a
 *     multi-line directive spans are kept, so line numbers in errors still
 *     point at the caller's source.
 */
function preprocess(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(
      /<(\w+)([^>]*)>/g,
      (_match, tag: string, attributes: string) =>
        '<' + tag + attributes.replace(/="([^"]*)"/g, "='$1'") + '>',
    )
    .replace(DIRECTIVE_REGEX, (directive) => directive.replace(/[^\n]/g, ''))
}

function countNewlines(text: string): number {
  let count = 0
  for (const ch of text) if (ch === '\n') count++
  return count
}

/** Build a `Line N: …` error quoting the offending source line. */
function lineError(
  lines: readonly string[],
  line: number,
  message: string,
): Error {
  /* v8 ignore next -- every caller passes a line inside `lines` */
  const source = (lines[line - 1] ?? '').trim()
  return new Error(`Line ${line}: ${message} in "${source}". ${SYNTAX_HELP}`)
}

/** What the lexer expected at a position it couldn't tokenize. */
function lexHint(source: string, pos: number, previous?: Token): string {
  const ch = source[pos]
  if (ch === '"' || ch === "'") {
    return `Unterminated quoted label (missing closing ${ch})`
  }
  if (previous?.kind === 'COLON') {
    return 'Invalid slice value — expected a number like 42 or 42.5 after ":"'
  }
  const atLineStart =
    previous === undefined ||
    previous.kind === 'NEWLINE' ||
    previous.kind === 'PIE' ||
    previous.kind === 'SHOW_DATA'
  if (atLineStart) {
    return 'Unrecognized statement — slice labels must be quoted, e.g. "Dogs" : 42'
  }
  return `Unexpected text ${JSON.stringify(source.slice(pos).split('\n')[0])}`
}

function tokenize(source: string, lines: readonly string[]): Token[] {
  const tokens: Token[] = []
  let pos = 0
  let line = 1

  while (pos < source.length) {
    let matched = false
    for (const [kind, pattern] of TOKEN_PATTERNS) {
      pattern.lastIndex = pos
      const match = pattern.exec(source)
      if (match === null || match[0].length === 0) continue
      const text = match[0]
      if (kind !== null) tokens.push({ kind, text, line })
      line += countNewlines(text)
      pos += text.length
      matched = true
      break
    }
    if (!matched) {
      throw lineError(lines, line, lexHint(source, pos, tokens.at(-1)))
    }
  }

  return tokens
}

/**
 * Langium's default `STRING` value conversion (ValueConverter.convertString):
 * drop the surrounding quotes and resolve backslash escapes. Mermaid's pie
 * value converter doesn't override it for slice labels.
 */
function convertString(input: string): string {
  let result = ''
  for (let i = 1; i < input.length - 1; i++) {
    const ch = input.charAt(i)
    if (ch !== '\\') {
      result += ch
      continue
    }
    const escaped = input.charAt(++i)
    switch (escaped) {
      case 'b':
        result += '\b'
        break
      case 'f':
        result += '\f'
        break
      case 'n':
        result += '\n'
        break
      case 'r':
        result += '\r'
        break
      case 't':
        result += '\t'
        break
      case 'v':
        result += '\v'
        break
      case '0':
        result += '\0'
        break
      default:
        result += escaped
    }
  }
  return result
}

/**
 * Mermaid's `AbstractMermaidValueConverter.runCommonConverter` for the
 * TITLE / ACC_TITLE / ACC_DESCR tokens.
 */
function convertTitleLike(kind: TokenKind, text: string): string {
  const regex =
    kind === 'ACC_DESCR'
      ? ACC_DESCR_VALUE
      : kind === 'ACC_TITLE'
        ? ACC_TITLE_VALUE
        : TITLE_VALUE
  const match = regex.exec(text)
  if (match?.[1] !== undefined) {
    return match[1].trim().replace(/[\t ]{2,}/gm, ' ')
  }
  // Only the `accDescr { … }` form leaves group 1 unset, and it always sets
  // group 2: every TITLE / ACC_TITLE / ACC_DESCR token matches its value
  // regex. (Mermaid's converter returns undefined if neither group is set.)
  /* v8 ignore next */
  const braced = match?.[2] ?? ''
  return braced
    .replace(/^\s*/gm, '')
    .replace(/\s+$/gm, '')
    .replace(/[\t ]{2,}/gm, ' ')
    .replace(/[\n\r]{2,}/gm, '\n')
}

const DESCRIBE: Record<TokenKind, string> = {
  NEWLINE: 'end of line',
  PIE: '"pie"',
  SHOW_DATA: '"showData"',
  COLON: '":"',
  NUMBER: 'number',
  STRING: 'quoted label',
  TITLE: 'title',
  ACC_TITLE: 'accTitle',
  ACC_DESCR: 'accDescr',
}

interface RawSlice extends PieSlice {
  line: number
}

/**
 * Parse Mermaid pie chart source text.
 *
 * Throws `Line N: …` errors (the shape the MCP diagnostics expect) for
 * anything Mermaid's own parser would reject.
 */
export function parsePieChart(text: string): PieChart {
  const source = preprocess(text)
  const lines = source.split('\n')
  const tokens = tokenize(source, lines)
  let i = 0

  const unexpected = (token: Token | undefined, expected: string): Error => {
    if (token === undefined) {
      return lineError(
        lines,
        lines.length,
        `Unexpected end of input — expected ${expected}`,
      )
    }
    let message = `Unexpected ${DESCRIBE[token.kind]} — expected ${expected}`
    if (token.kind === 'SHOW_DATA') {
      message +=
        '; showData is only allowed directly after "pie" on the header line'
    } else if (token.kind === 'PIE') {
      message += '; the "pie" header may only appear once'
    }
    return lineError(lines, token.line, message)
  }

  /** Statements end at a newline or the end of the text (Mermaid's `EOL`). */
  const expectEndOfStatement = (what: string): void => {
    const next = tokens[i]
    if (next !== undefined && next.kind !== 'NEWLINE') {
      throw unexpected(next, `end of line after ${what}`)
    }
  }

  while (tokens[i]?.kind === 'NEWLINE') i++
  if (tokens[i]?.kind !== 'PIE') {
    throw unexpected(tokens[i], 'the "pie" header')
  }
  i++

  let showData = false
  if (tokens[i]?.kind === 'SHOW_DATA') {
    showData = true
    i++
  }

  let title = ''
  let accTitle = ''
  let accDescr = ''
  const rawSlices: RawSlice[] = []

  while (i < tokens.length) {
    const token = tokens[i]!
    switch (token.kind) {
      case 'NEWLINE':
        i++
        break
      case 'TITLE':
      case 'ACC_TITLE':
      case 'ACC_DESCR': {
        const value = convertTitleLike(token.kind, token.text)
        if (token.kind === 'TITLE') title = value
        else if (token.kind === 'ACC_TITLE') accTitle = value
        else accDescr = value
        i++
        expectEndOfStatement(DESCRIBE[token.kind])
        break
      }
      case 'STRING': {
        i++
        if (tokens[i]?.kind !== 'COLON') {
          throw unexpected(tokens[i], '":" after the slice label')
        }
        i++
        const valueToken = tokens[i]
        if (valueToken?.kind !== 'NUMBER') {
          throw unexpected(valueToken, 'a number after ":"')
        }
        i++
        expectEndOfStatement('the slice value')
        rawSlices.push({
          label: convertString(token.text),
          value: Number(valueToken.text),
          line: token.line,
        })
        break
      }
      default:
        throw unexpected(
          token,
          'a quoted slice label, title, accTitle, or accDescr',
        )
    }
  }

  // Mermaid's pieDb.addSection, applied in source order once the whole
  // chart has parsed: negative check first, then first-label-wins.
  const slices: PieSlice[] = []
  const seen = new Set<string>()
  for (const { label, value, line } of rawSlices) {
    if (value < 0) {
      throw new Error(
        `Line ${line}: "${label}" has invalid value: ${value}. Negative values are not allowed in pie charts. All slice values must be >= 0.`,
      )
    }
    if (seen.has(label)) continue
    seen.add(label)
    // `-0` passes Mermaid's `< 0` check; store it as plain 0.
    slices.push({ label, value: value === 0 ? 0 : value })
  }

  const chart: PieChart = { showData, slices }
  if (title) chart.title = title
  if (accTitle) chart.accTitle = accTitle
  if (accDescr) chart.accDescr = accDescr
  return chart
}
