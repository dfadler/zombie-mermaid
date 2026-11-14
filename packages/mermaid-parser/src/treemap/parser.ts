import { MermaidParseError } from '@zombie-mermaid/core'
import { sanitizeTitle } from '../sanitize-title.ts'
import type { Treemap, TreemapNode, TreemapStyle } from './types.ts'

// ============================================================================
// Treemap parser
//
// A port of Mermaid's Langium grammar and treemap db (mermaid-js/mermaid
// packages/parser/src/language/treemap/treemap.langium and
// packages/mermaid/src/diagrams/treemap/{parser,utils,db}.ts, checked against
// mermaid@12.3.0):
//
//   treemap | treemap-beta
//   title <text>
//   "Section"                      (indented rows are its children)
//     "Leaf": 12                   (`,` also separates; value 1,000.5 allowed)
//     "Leaf": 12:::className
//   classDef className fill:#f96,stroke:#333;
//
// Rules taken from Mermaid:
//   - The header is case-sensitive. Newlines and `%%` comments are skipped, so
//     the header and rows need not sit on their own lines.
//   - A row's depth is the length of the blank run directly before its name
//     (0 when none); a row is a child of the nearest earlier section with a
//     smaller depth. A leaf never holds children: rows after it climb out.
//   - A name is a quoted string, single or double, with no escapes. A bare
//     word, `;`, a negative value and a blank run before a trailing `%%`
//     comment are errors (that blank run reads as the next row's indent).
//   - `"Name":::class` styles a section; a leaf takes `:::class` after its
//     value. `classDef` rows apply wherever they sit; an unknown class does
//     nothing. Only the last `title` counts.
//   - A section with no children draws as a leaf of value 0.
//   - Mermaid does not enforce the grammar's "single root" check, so several
//     top-level rows are fine (they share the canvas).
//
// Parsed from the raw text, not `Statement[]`: `;` is not a separator here.
// accTitle/accDescr are stripped by `extractAccessibility` before the
// renderers call this; called directly, they are accepted and ignored.
// ============================================================================

type TokenKind =
  | 'SKIP'
  | 'HEADER'
  | 'TITLE'
  | 'CLASS_DEF'
  | 'STYLE_SEP'
  | 'COLON'
  | 'COMMA'
  | 'INDENT'
  | 'ID'
  | 'NUMBER'
  | 'STRING'
  | 'INVALID'

/** Langium's terminal order: keywords, then the grammar's terminals. */
const RULES: ReadonlyArray<readonly [TokenKind, RegExp]> = [
  [
    'SKIP',
    /[\t ]*accDescr(?:[\t ]*:(?:[^\n\r]*?(?=%%)|[^\n\r]*)|\s*\{[^}]*\})/y,
  ],
  ['SKIP', /[\t ]*accTitle[\t ]*:(?:[^\n\r]*?(?=%%)|[^\n\r]*)/y],
  ['TITLE', /[\t ]*title(?:[\t ][^\n\r]*?(?=%%)|[\t ][^\n\r]*|)/y],
  ['HEADER', /treemap-beta|treemap/y],
  [
    'CLASS_DEF',
    /classDef\s+([a-zA-Z_][a-zA-Z0-9_]+)(?:\s+([^;\r\n]*))?(?:;)?/y,
  ],
  ['STYLE_SEP', /:::/y],
  ['COLON', /:/y],
  ['COMMA', /,/y],
  ['INDENT', /[ \t]+/y],
  ['SKIP', /%%[^\n]*/y],
  ['SKIP', /\r?\n/y],
  ['ID', /[a-zA-Z_][a-zA-Z0-9_]*/y],
  ['NUMBER', /[0-9_.,]+/y],
  ['STRING', /"[^"]*"|'[^']*'/y],
  ['INVALID', /[\s\S]/y],
]

const DIRECTIVE = /%%\{[\s\S]*?\}%%/g

function lineOf(text: string, pos: number): number {
  let line = 1
  for (let i = 0; i < pos; i++) if (text.charCodeAt(i) === 10) line++
  return line
}

/** Mermaid's `addClass`: the style text split on `,` and `;` into `key:value` items. */
function parseStyles(styleText: string): TreemapStyle[] {
  return styleText
    .replace(/\\,/g, '§§§')
    .replace(/,/g, ';')
    .replace(/§§§/g, ',')
    .split(';')
    .map((s) => {
      const [key = '', value] = s.split(':')
      return { key: key.trim(), value: (value ?? '').trim() }
    })
    .filter((s) => s.key !== '')
}

interface Row {
  level: number
  node: TreemapNode
  leaf: boolean
}

/** Parse Mermaid `treemap` / `treemap-beta` source into a typed {@link Treemap}. */
export function parseTreemap(text: string): Treemap {
  const source = text
    .replace(/\r\n?/g, '\n')
    // Directives are removed by Mermaid before lexing; keep their newlines so
    // error line numbers still match the caller's source.
    .replace(DIRECTIVE, (d) => d.replace(/[^\n]/g, ''))
  const fail = (pos: number, msg: string): never => {
    throw new MermaidParseError(`Line ${lineOf(source, pos)}: ${msg}`, {
      diagramType: 'treemap',
    })
  }

  interface Tok {
    kind: TokenKind
    value: string
    at: number
    m: RegExpExecArray
  }
  const toks: Tok[] = []
  for (let pos = 0; pos < source.length;) {
    let kind: TokenKind = 'INVALID'
    let m: RegExpExecArray | null = null
    for (const [k, re] of RULES) {
      re.lastIndex = pos
      m = re.exec(source)
      if (m) {
        kind = k
        break
      }
    }
    const value = m![0]
    if (kind !== 'SKIP') toks.push({ kind, value, at: pos, m: m! })
    pos += value.length
  }

  let i = 0
  const peek = (): Tok | undefined => toks[i]
  // Blanks before the header are fine (they lex as an indent).
  while (peek()?.kind === 'INDENT') i++
  if (peek()?.kind !== 'HEADER') {
    throw new MermaidParseError(
      'Expected the "treemap" or "treemap-beta" header',
      {
        diagramType: 'treemap',
      },
    )
  }
  i++

  const describe = (t: Tok | undefined): string =>
    t ? `"${t.value.trim() || t.value}"` : 'the end of the text'
  const name = (t: Tok): string => t.value.slice(1, -1)

  const rows: Row[] = []
  const classes = new Map<string, TreemapStyle[]>()
  let title: string | undefined

  while (i < toks.length) {
    const t = toks[i]!
    if (t.kind === 'TITLE') {
      i++
      const body = t.value.replace(/^[\t ]*title/, '').trim()
      title = sanitizeTitle(body.replace(/[\t ]{2,}/g, ' ')) || undefined
      continue
    }
    if (t.kind === 'CLASS_DEF') {
      i++
      classes.set(t.m[1]!, [
        ...(classes.get(t.m[1]!) ?? []),
        ...parseStyles(t.m[2] ?? ''),
      ])
      continue
    }
    let level = 0
    let at = t
    if (t.kind === 'INDENT') {
      level = t.value.length
      i++
      at = peek() as Tok
    }
    if (at?.kind !== 'STRING') {
      fail(
        at?.at ?? source.length,
        `Expected a quoted name ("..." or '...'), found ${describe(at)}`,
      )
    }
    i++
    const node: TreemapNode = { name: name(at), styles: [] }
    let leaf = false
    let n = peek()
    if (
      n?.kind === 'INDENT' &&
      /^(?:COLON|COMMA)$/.test(toks[i + 1]?.kind ?? '')
    ) {
      i++
      n = peek()
    }
    if (n?.kind === 'COLON' || n?.kind === 'COMMA') {
      i++
      if (peek()?.kind === 'INDENT' && toks[i + 1]?.kind === 'NUMBER') i++
      const v = peek()
      if (v?.kind !== 'NUMBER') {
        fail(
          v?.at ?? source.length,
          `Expected a value after the name, found ${describe(v)}`,
        )
      }
      i++
      const value = parseFloat(v!.value.replace(/,/g, ''))
      if (!Number.isFinite(value)) {
        fail(v!.at, `The value "${v!.value}" is not a number`)
      }
      node.value = value
      leaf = true
    }
    if (peek()?.kind === 'STYLE_SEP') {
      i++
      const id = peek()
      if (id?.kind !== 'ID') {
        fail(
          id?.at ?? source.length,
          `Expected a class name after ":::", found ${describe(id)}`,
        )
      }
      i++
      node.classSelector = id!.value
    }
    rows.push({ level, node, leaf })
  }

  for (const r of rows) {
    if (r.node.classSelector !== undefined) {
      r.node.styles = classes.get(r.node.classSelector) ?? []
    }
  }

  // Mermaid's buildHierarchy.
  const roots: TreemapNode[] = []
  const stack: Array<{ node: TreemapNode; level: number }> = []
  for (const { level, node, leaf } of rows) {
    if (!leaf) node.children = []
    while (stack.length > 0 && stack[stack.length - 1]!.level >= level) {
      stack.pop()
    }
    const parent = stack[stack.length - 1]?.node
    if (parent) (parent.children ??= []).push(node)
    else roots.push(node)
    if (!leaf) stack.push({ node, level })
  }

  const treemap: Treemap = { roots }
  if (title !== undefined) treemap.title = title
  return treemap
}
