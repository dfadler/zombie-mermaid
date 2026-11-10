import { extractInitConfig, MermaidParseError } from '@zombie-mermaid/core'
import type { Radar, RadarAxis, RadarCurve, RadarOptions } from './types.ts'

// ============================================================================
// Radar parser
//
// A port of Mermaid's Langium grammar and database (@mermaid-js/parser
// `radar.langium`, mermaid `diagrams/radar/db.ts`, checked against 12.3.0):
//
//   radar-beta[:]
//   title <text>
//   axis <id>["label"], <id>["label"], ...
//   curve <id>["label"]{1, 2, 3}  |  curve <id>{<axis>: 1, <axis>: 2}
//   showLegend true|false, ticks <n>, max <n>, min <n>, graticule circle|polygon
//
// Rules taken from Mermaid:
//   - Tokens are tried in the Langium order, first match wins: strings,
//     numbers, then `title` / `accTitle` / `accDescr`, then `true|false` and
//     `circle|polygon` (with no word boundary: an axis called `circles` is an
//     error), then identifiers. Identifiers equal to a keyword are keywords.
//   - Newlines are tokens: `axis a,` followed by a newline is an error, a
//     curve's entries may span lines, `curve c` and its `{` may not.
//   - Numbers are `12` or `1.5` (no sign, exponent, trailing dot or leading
//     zero). The statements need no separator: `axis a curve c{1}` is valid.
//   - Axes are collected before curves, wherever they are written; a curve
//     written with `axis: value` entries takes its values in axis order, with
//     a missing axis an error and an unknown one ignored.
//   - `ticks` above 32 is clamped to 32.
//
// Parsed from the raw text, not `Statement[]`: the grammar has no `;`
// separator. accTitle/accDescr are stripped by `extractAccessibility` before
// the renderers call this; called directly, they are accepted and ignored.
// ============================================================================

type Kind =
  | 'NL'
  | 'KW'
  | 'ID'
  | 'NUM'
  | 'STR'
  | 'BOOL'
  | 'GRAT'
  | 'TITLE'
  | 'ACC'
  | 'PUNCT'

interface Token {
  kind: Kind
  /** Source text; for `STR` the unescaped contents. */
  value: string
  line: number
}

const KEYWORDS = new Set([
  'radar-beta',
  'axis',
  'curve',
  'showLegend',
  'ticks',
  'max',
  'min',
  'graticule',
])
const OPTION_NAMES = new Set(['showLegend', 'ticks', 'max', 'min', 'graticule'])

/** Hidden terminals (YAML front matter, directives, comments, blanks), tried before the rest. */
const SKIP =
  /---[\t ]*\r?\n(?:[\S\s]*?\r?\n)?---(?:\r?\n|(?!\S))|[\t ]*%%\{[\S\s]*?\}%%(?:\r?\n|(?!\S))|[\t ]*%%[^\n\r]*|[\t ]+/y
const NEWLINE = /\r?\n/y
const STRING = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/y
const FLOAT = /[0-9]+\.[0-9]+(?!\.)/y
const INT = /0|[1-9][0-9]*(?!\.)/y
const TITLE = /[\t ]*title(?:[\t ][^\n\r]*?(?=%%)|[\t ][^\n\r]*|)/y
const ACC_TITLE = /[\t ]*accTitle[\t ]*:(?:[^\n\r]*?(?=%%)|[^\n\r]*)/y
const ACC_DESCR =
  /[\t ]*accDescr(?:[\t ]*:(?:[^\n\r]*?(?=%%)|[^\n\r]*)|\s*\{[^}]*\})/y
const BOOLEAN = /true|false/y
const GRATICULE = /circle|polygon/y
const IDENT = /\w(?:[-\w]*\w)?/y

const ESCAPES: Record<string, string> = {
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
  '0': '\0',
}

function unquote(raw: string): string {
  return raw.slice(1, -1).replace(/\\(.)/gs, (_, c: string) => ESCAPES[c] ?? c)
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let line = 1
  let pos = 0
  const match = (re: RegExp): string | undefined => {
    re.lastIndex = pos
    return re.exec(source)?.[0]
  }
  const push = (kind: Kind, value: string, text = value): void => {
    tokens.push({ kind, value, line })
    pos += text.length
    for (const ch of text) if (ch === '\n') line++
  }

  while (pos < source.length) {
    const skip = match(SKIP)
    if (skip !== undefined) {
      pos += skip.length
      for (const ch of skip) if (ch === '\n') line++
      continue
    }
    const nl = match(NEWLINE)
    if (nl !== undefined) {
      push('NL', nl)
      continue
    }
    const ch = source[pos] as string
    if (',{}[]:'.includes(ch)) {
      push('PUNCT', ch)
      continue
    }
    const str = match(STRING)
    if (str !== undefined) {
      push('STR', unquote(str), str)
      continue
    }
    const num = match(FLOAT) ?? match(INT)
    if (num !== undefined) {
      push('NUM', num)
      continue
    }
    const title = match(TITLE)
    if (title !== undefined) {
      push('TITLE', title)
      continue
    }
    const acc = match(ACC_TITLE) ?? match(ACC_DESCR)
    if (acc !== undefined) {
      push('ACC', acc)
      continue
    }
    const bool = match(BOOLEAN)
    if (bool !== undefined) {
      push('BOOL', bool)
      continue
    }
    const grat = match(GRATICULE)
    if (grat !== undefined) {
      push('GRAT', grat)
      continue
    }
    const id = match(IDENT)
    if (id !== undefined) {
      push(KEYWORDS.has(id) ? 'KW' : 'ID', id)
      continue
    }
    throw new MermaidParseError(`Line ${line}: Unexpected character "${ch}"`, {
      diagramType: 'radar',
    })
  }
  return tokens
}

/** Mermaid's converter for a `title` token: the text after the keyword, blanks collapsed. */
function titleText(raw: string): string {
  return raw
    .replace(/^\s*title\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

interface RawEntry {
  axis?: string
  value: number
}
interface RawCurve {
  name: string
  label?: string
  entries: RawEntry[]
}

const MAX_TICKS = 32

/** Parse Mermaid `radar-beta` source into a typed {@link Radar}. */
export function parseRadar(text: string): Radar {
  const tokens = tokenize(text.replace(/\r\n?/g, '\n'))
  let i = 0
  const peek = (): Token | undefined => tokens[i]
  const fail = (found: Token | undefined, expected: string): never => {
    const where = found
      ? `Line ${found.line}: Unexpected "${found.value.trim() || 'newline'}"`
      : 'Unexpected end of input'
    throw new MermaidParseError(`${where}, expected ${expected}`, {
      diagramType: 'radar',
    })
  }
  const isPunct = (t: Token | undefined, p: string): boolean =>
    t?.kind === 'PUNCT' && t.value === p
  const skipNewlines = (): void => {
    while (peek()?.kind === 'NL') i++
  }
  const expect = (kind: Kind, what: string): Token => {
    const t = peek()
    if (t?.kind !== kind) return fail(t, what)
    i++
    return t
  }
  const expectPunct = (p: string): void => {
    const t = peek()
    if (!isPunct(t, p)) fail(t, `"${p}"`)
    i++
  }
  const optLabel = (): string | undefined => {
    if (!isPunct(peek(), '[')) return undefined
    i++
    const label = expect('STR', 'a quoted label').value
    expectPunct(']')
    return label
  }

  skipNewlines()
  const header = peek()
  if (header?.kind !== 'KW' || header.value !== 'radar-beta')
    fail(header, 'the "radar-beta" header')
  i++
  if (isPunct(peek(), ':')) i++

  let title: string | undefined
  const axes: Array<{ name: string; label?: string }> = []
  const rawCurves: RawCurve[] = []
  const given = new Map<string, Token>()

  while (i < tokens.length) {
    const t = tokens[i] as Token
    if (t.kind === 'NL') {
      i++
    } else if (t.kind === 'ACC') {
      i++
    } else if (t.kind === 'TITLE') {
      i++
      title = titleText(t.value) || undefined
    } else if (t.kind === 'KW' && t.value === 'axis') {
      i++
      do {
        const name = expect('ID', 'an axis name').value
        const label = optLabel()
        axes.push(label === undefined ? { name } : { name, label })
      } while (isPunct(peek(), ',') && ++i)
    } else if (t.kind === 'KW' && t.value === 'curve') {
      i++
      do {
        const name = expect('ID', 'a curve name').value
        const label = optLabel()
        expectPunct('{')
        const entries: RawEntry[] = []
        skipNewlines()
        const detailed = peek()?.kind === 'ID'
        for (;;) {
          skipNewlines()
          if (detailed) {
            const axis = expect('ID', 'an axis name').value
            if (isPunct(peek(), ':')) i++
            entries.push({
              axis,
              value: Number(expect('NUM', 'a number').value),
            })
          } else {
            entries.push({ value: Number(expect('NUM', 'a number').value) })
          }
          // Blank lines may follow the last value or a comma, not precede a comma.
          if (!isPunct(peek(), ',')) break
          i++
        }
        skipNewlines()
        expectPunct('}')
        rawCurves.push(
          label === undefined ? { name, entries } : { name, label, entries },
        )
      } while (isPunct(peek(), ',') && ++i)
    } else if (t.kind === 'KW' && OPTION_NAMES.has(t.value)) {
      do {
        const opt = expect('KW', 'an option')
        if (!OPTION_NAMES.has(opt.value)) fail(opt, 'an option')
        const kind: Kind =
          opt.value === 'showLegend'
            ? 'BOOL'
            : opt.value === 'graticule'
              ? 'GRAT'
              : 'NUM'
        given.set(
          opt.value,
          expect(kind, `a ${kind === 'NUM' ? 'number' : 'valid value'}`),
        )
      } while (isPunct(peek(), ',') && ++i)
    } else {
      fail(t, 'a statement')
    }
  }

  const radarAxes: RadarAxis[] = axes.map((a) => ({
    name: a.name,
    label: a.label ?? a.name,
  }))
  const curves: RadarCurve[] = rawCurves.map((c) => ({
    name: c.name,
    label: c.label ?? c.name,
    entries: curveEntries(c, radarAxes),
  }))

  const opt = (name: string): string | undefined => given.get(name)?.value
  const options: RadarOptions = {
    showLegend:
      opt('showLegend') === undefined ? true : opt('showLegend') === 'true',
    ticks: Math.min(
      opt('ticks') === undefined ? 5 : Number(opt('ticks')),
      MAX_TICKS,
    ),
    max: opt('max') === undefined ? null : Number(opt('max')),
    min: opt('min') === undefined ? 0 : Number(opt('min')),
    graticule: opt('graticule') === 'polygon' ? 'polygon' : 'circle',
  }

  const radar: Radar = { axes: radarAxes, curves, options }
  const init = extractInitConfig(text.split(/\r\n?|\n/))
  if (init.radar) radar.config = init.radar
  if (init.radarTheme) radar.style = init.radarTheme
  if (title !== undefined) radar.title = title
  return radar
}

/** Mermaid's `computeCurveEntries`: plain values as written, references in axis order. */
function curveEntries(curve: RawCurve, axes: RadarAxis[]): number[] {
  const first = curve.entries[0] as RawEntry
  if (first.axis === undefined) return curve.entries.map((e) => e.value)
  if (axes.length === 0)
    throw new MermaidParseError(
      'Axes must be populated before curves for reference entries',
      { diagramType: 'radar' },
    )
  return axes.map((axis) => {
    const entry = curve.entries.find((e) => e.axis === axis.name)
    if (entry === undefined)
      throw new MermaidParseError(`Missing entry for axis ${axis.label}`, {
        diagramType: 'radar',
      })
    return entry.value
  })
}
