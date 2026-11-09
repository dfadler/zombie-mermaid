import {
  MermaidParseError,
  decodeMermaidEntities,
  extractInitConfig,
  stripFrontMatter,
} from '@zombie-mermaid/core'
import type { Kanban, KanbanCard, KanbanColumn } from './types.ts'

// ============================================================================
// Kanban parser
//
// A port of Mermaid's kanban grammar (mermaid-js/mermaid
// packages/mermaid/src/diagrams/kanban/parser/kanban.jison and kanbanDb.ts, as
// shipped in mermaid 12.3.0). Mermaid lexes with jison: the first rule that
// matches wins (not the longest) and the rule set depends on the current
// state. The lexer below keeps those rules, in order, so the accepted language
// is the same, quirks included. It is the mindmap lexer plus `@{ ... }` data:
//
//   kanban
//     column                   a line at the first node's indentation
//       id[card text]          any other indentation is a card of the column
//       id[card]@{ ticket: MC-1, assigned: 'knsv', priority: 'High' }
//     [another column]
//
//   - A node is bare text, or `id` followed by `[text]`, `(text)`, `((text))`,
//     `)text(`, `))text((` or `{{text}}`. Mermaid ignores the shape on kanban
//     nodes; only the text inside the delimiter is drawn, the id is not.
//   - `@{ key: value, ... }` after a node (flow style on one line, `key: value`
//     lines when it spans lines) sets `ticket`, `assigned`, `priority`, `label`
//     (replaces the text) and `icon`. A `shape` key must be lowercase.
//   - `::icon(...)` and `:::class` go on their own line under a node.
//   - The first node is a column; a card is any later node that is not at the
//     indentation of the last column. A line indented less than the first
//     column is "Items without section detected".
// ============================================================================

const SYNTAX_HELP =
  'A kanban board is `kanban` followed by column lines and, indented under each, card lines: `text` or `id[text]`, optionally followed by `@{ ticket: ID, assigned: name, priority: High }`.'

type TokenKind =
  | 'KANBAN'
  | 'SPACELINE'
  | 'NL'
  | 'SPACELIST'
  | 'ICON'
  | 'CLASS'
  | 'NODE_DSTART'
  | 'NODE_DESCR'
  | 'NODE_DEND'
  | 'NODE_ID'
  | 'SHAPE_DATA'
  | 'EOF'

interface Token {
  kind: TokenKind
  text: string
  line: number
}

type LexState =
  | 'INITIAL'
  | 'CLASS'
  | 'ICON'
  | 'NODE'
  | 'NSTR'
  | 'NSTR2'
  | 'SHAPEDATA'
  | 'SHAPEDATASTR'

/** `[pattern, token kind (null: none), state to push or 'POP', text override]`. */
type Rule = [
  RegExp,
  TokenKind | null,
  LexState | 'POP' | undefined,
  ((text: string) => string)?,
]

const RULES: Record<LexState, Rule[]> = {
  INITIAL: [
    [/@\{/iy, 'SHAPE_DATA', 'SHAPEDATA', () => ''],
    [/\s*%%.*/iy, 'SPACELINE', undefined],
    [/kanban\b/iy, 'KANBAN', undefined],
    [/:::/iy, null, 'CLASS'],
    [/::icon\(/iy, null, 'ICON'],
    [/\s+\n/iy, 'SPACELINE', undefined],
    [/\n+/iy, 'NL', undefined],
    [/-\)/iy, 'NODE_DSTART', 'NODE'],
    [/\(-/iy, 'NODE_DSTART', 'NODE'],
    [/\)\)/iy, 'NODE_DSTART', 'NODE'],
    [/\)/iy, 'NODE_DSTART', 'NODE'],
    [/\(\(/iy, 'NODE_DSTART', 'NODE'],
    [/\{\{/iy, 'NODE_DSTART', 'NODE'],
    [/\(/iy, 'NODE_DSTART', 'NODE'],
    [/\[/iy, 'NODE_DSTART', 'NODE'],
    [/\s+/iy, 'SPACELIST', undefined],
    [/[^(\[\n){}@]+/iy, 'NODE_ID', undefined],
    [/$/iy, 'EOF', undefined],
  ],
  CLASS: [
    [/.+/iy, 'CLASS', 'POP'],
    [/\n/iy, null, 'POP'],
  ],
  ICON: [
    [/[^)]+/iy, 'ICON', undefined],
    [/\)/iy, null, 'POP'],
  ],
  NODE: [
    [/"`/iy, null, 'NSTR2'],
    [/"/iy, null, 'NSTR'],
    [/\)\)/iy, 'NODE_DEND', 'POP'],
    [/\)/iy, 'NODE_DEND', 'POP'],
    [/\]/iy, 'NODE_DEND', 'POP'],
    [/\}\}/iy, 'NODE_DEND', 'POP'],
    [/\(-/iy, 'NODE_DEND', 'POP'],
    [/-\)/iy, 'NODE_DEND', 'POP'],
    [/\(\(/iy, 'NODE_DEND', 'POP'],
    [/\(/iy, 'NODE_DEND', 'POP'],
    [/[^)\](}]+/iy, 'NODE_DESCR', undefined],
    [/.+(?!\(\()/iy, 'NODE_DESCR', undefined],
  ],
  NSTR2: [
    [/[^`"]+/iy, 'NODE_DESCR', undefined],
    [/`"/iy, null, 'POP'],
  ],
  NSTR: [
    [/[^"]+/iy, 'NODE_DESCR', undefined],
    [/"/iy, null, 'POP'],
  ],
  // In `@{ ... }` a quote opens a string; `}` ends the data (`^` is not text).
  SHAPEDATA: [
    [/"/iy, 'SHAPE_DATA', 'SHAPEDATASTR'],
    [/[^}^"]+/iy, 'SHAPE_DATA', undefined],
    [/\}/iy, null, 'POP'],
  ],
  SHAPEDATASTR: [
    [/"/iy, 'SHAPE_DATA', 'POP'],
    [/[^"]+/iy, 'SHAPE_DATA', undefined, (t) => t.replace(/\n\s*/g, '<br/>')],
  ],
}

const DIRECTIVE_REGEX =
  /%{2}{\s*(?:(\w+)\s*:|(\w+))\s*(?:(\w+)|((?:(?!}%{2}).|\r?\n)*))?\s*(?:}%{2})?/gi

/** CRLF to LF, `%%{init}%%` blanked (newlines kept), front matter blanked. */
function preprocess(text: string): string {
  return stripFrontMatter(text.replace(/\r\n?/g, '\n')).replace(
    DIRECTIVE_REGEX,
    (directive) => directive.replace(/[^\n]/g, ''),
  )
}

function parseError(
  lines: readonly string[],
  line: number,
  message: string,
): MermaidParseError {
  const source = (lines[line - 1] ?? '').trim()
  return new MermaidParseError(
    `Line ${line}: ${message}${source ? ` in "${source}"` : ''}. ${SYNTAX_HELP}`,
    { diagramType: 'kanban', line },
  )
}

function tokenize(source: string, lines: readonly string[]): Token[] {
  const tokens: Token[] = []
  const stack: LexState[] = ['INITIAL']
  let pos = 0
  let line = 1
  const advance = (text: string) => {
    for (const ch of text) if (ch === '\n') line++
    pos += text.length
  }
  while (pos < source.length || stack[stack.length - 1] === 'INITIAL') {
    const state = stack[stack.length - 1]!
    let matched = false
    for (const [re, kind, next, override] of RULES[state]) {
      re.lastIndex = pos
      const m = re.exec(source)
      if (m === null) continue
      matched = true
      const text = m[0]
      if (kind === 'EOF') {
        tokens.push({ kind, text, line })
        return tokens
      }
      if (kind !== null) {
        tokens.push({ kind, text: override ? override(text) : text, line })
      }
      advance(text)
      if (next === 'POP') stack.pop()
      else if (next !== undefined) stack.push(next)
      break
    }
    if (!matched) {
      if (pos >= source.length) break
      throw parseError(
        lines,
        line,
        `Unexpected "${source.slice(pos, pos + 1)}"`,
      )
    }
  }
  tokens.push({ kind: 'EOF', text: '', line })
  return tokens
}

// --- `@{ ... }` metadata (js-yaml, JSON schema, in Mermaid) -----------------

type Scalar = string | number | boolean | null

/** A YAML scalar under the JSON schema: quoted text is a string, bare text may be null, boolean or number. */
function scalar(raw: string): Scalar {
  const v = raw.trim()
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"'))
    return v.slice(1, -1).replace(/\\(["\\])/g, '$1')
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'"))
    return v.slice(1, -1).replace(/''/g, "'")
  if (v === '' || v === 'null') return null
  if (v === 'true') return true
  if (v === 'false') return false
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][-+]?\d+)?$/.test(v)) return Number(v)
  return v
}

/** Split on `sep` outside quotes. */
function splitOutsideQuotes(text: string, sep: string): string[] {
  const parts: string[] = []
  let cur = ''
  let quote: string | null = null
  for (const ch of text) {
    if (quote !== null) {
      if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'") quote = ch
    else if (ch === sep) {
      parts.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  parts.push(cur)
  return parts
}

/** Index of the first `: ` (or trailing `:`) outside quotes, or -1. */
function keyEnd(entry: string): number {
  let quote: string | null = null
  for (let i = 0; i < entry.length; i++) {
    const ch = entry[i]!
    if (quote !== null) {
      if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'") quote = ch
    else if (ch === ':' && (i === entry.length - 1 || /\s/.test(entry[i + 1]!)))
      return i
  }
  return -1
}

/** The metadata object of an `@{ ... }` block, flow style on one line, `key: value` lines otherwise. */
function parseShapeData(data: string): Record<string, Scalar> {
  const entries = data.includes('\n')
    ? data.split('\n')
    : splitOutsideQuotes(data, ',')
  const doc: Record<string, Scalar> = {}
  for (const entry of entries) {
    const e = entry.trim()
    if (e === '') continue
    // A bare `key` is a key with a null value in a YAML flow mapping.
    const colon = keyEnd(e)
    const key = String(scalar(colon === -1 ? e : e.slice(0, colon)))
    doc[key] = colon === -1 ? null : scalar(e.slice(colon + 1))
  }
  return doc
}

/**
 * Parse Mermaid `kanban` source into a typed {@link Kanban}.
 *
 * @throws MermaidParseError when Mermaid 12.3.0 would fail to parse the text.
 */
export function parseKanban(text: string): Kanban {
  const source = preprocess(text)
  const lines = source.split('\n')
  const tokens = tokenize(source, lines)
  let i = 0
  const peek = () => tokens[i]!

  const fail = (token: Token, expected: string): MermaidParseError =>
    parseError(
      lines,
      token.line,
      token.kind === 'EOF'
        ? `Unexpected end of input, expected ${expected}`
        : `Unexpected "${token.text.trim() || token.kind}", expected ${expected}`,
    )

  // Mermaid accepts an indented header (its detector is `^\\s*kanban`).
  while (
    peek().kind === 'SPACELINE' ||
    peek().kind === 'NL' ||
    peek().kind === 'SPACELIST'
  )
    i++
  if (peek().kind !== 'KANBAN') throw fail(peek(), 'the "kanban" header')
  i++
  // `kanban` with nothing after it is a parse error; `kanban` and a newline is an empty board.
  if (peek().kind === 'EOF') throw fail(peek(), 'a newline')

  interface Entry {
    level: number
    node: KanbanColumn | KanbanCard
  }
  const entries: Entry[] = []
  const columns: KanbanColumn[] = []
  let last: KanbanColumn | KanbanCard | undefined

  const addNode = (
    level: number,
    id: string,
    descr: string,
    data: string | undefined,
    token: Token,
  ) => {
    const node: KanbanCard = {
      id,
      text: decodeMermaidEntities(descr),
    }
    if (data !== undefined) {
      const doc = parseShapeData(data)
      const shape = doc.shape
      if (
        typeof shape === 'string' &&
        (shape !== shape.toLowerCase() || shape.includes('_'))
      ) {
        throw parseError(
          lines,
          token.line,
          `No such shape: ${shape}. Shape names should be lowercase.`,
        )
      }
      if (doc.label) node.text = decodeMermaidEntities(String(doc.label))
      if (doc.icon) node.icon = String(doc.icon)
      if (doc.assigned) node.assigned = String(doc.assigned)
      if (doc.ticket) node.ticket = String(doc.ticket)
      if (doc.priority) node.priority = String(doc.priority)
    }

    // Mermaid's `getSection`: the column is the last node at the first node's
    // level; a node at that level starts a new column.
    const columnLevel = entries[0]?.level
    let column: KanbanColumn | undefined
    if (columnLevel !== undefined) {
      for (let k = entries.length - 1; k >= 0; k--) {
        const e = entries[k]!
        if (e.level === columnLevel && column === undefined)
          column = e.node as KanbanColumn
        if (e.level < columnLevel) {
          throw parseError(
            lines,
            token.line,
            `Items without section detected, found section ("${e.node.text}")`,
          )
        }
      }
    }
    if (column === undefined || level === columnLevel) {
      const col: KanbanColumn = {
        id: node.id,
        text: node.text,
        cards: [],
      }
      columns.push(col)
      entries.push({ level, node: col })
      last = col
    } else {
      column.cards.push(node)
      entries.push({ level, node })
      last = node
    }
  }

  const decorate = (token: Token): void => {
    if (last === undefined) {
      throw parseError(
        lines,
        token.line,
        `An ${token.kind === 'ICON' ? 'icon' : 'class'} needs a node above it`,
      )
    }
    // Mermaid records an icon on a column too, but never draws it.
    if (token.kind === 'ICON') {
      if (!('cards' in last)) last.icon = token.text
    } else last.className = token.text
  }

  /** `node` of the grammar plus its optional `@{ ... }`; returns after the last token. */
  const parseNode = (indent: number): void => {
    const first = peek()
    let id: string | undefined
    if (first.kind === 'NODE_ID') {
      id = first.text
      i++
    }
    let descr: string
    if (peek().kind !== 'NODE_DSTART') {
      // The caller only gets here for a NODE_ID or NODE_DSTART, so a bare node has an id.
      id = id!.trimEnd()
      descr = id
    } else {
      i++
      const d = peek()
      if (d.kind !== 'NODE_DESCR') throw fail(d, 'the node text')
      i++
      const close = peek()
      if (close.kind !== 'NODE_DEND') throw fail(close, 'a closing bracket')
      i++
      descr = d.text
      id ??= descr
    }
    let data: string | undefined
    while (peek().kind === 'SHAPE_DATA') {
      data = (data ?? '') + peek().text
      i++
    }
    addNode(indent, id, descr, data, first)
  }

  /** A statement ends at a newline, a blank line or the end of the text. */
  const endOfStatement = (): void => {
    const t = peek()
    if (t.kind === 'NL' || t.kind === 'SPACELINE') {
      i++
      return
    }
    if (t.kind === 'EOF') return
    throw fail(t, 'the end of the line')
  }

  for (;;) {
    const t = peek()
    if (t.kind === 'EOF') break
    if (t.kind === 'NL' || t.kind === 'SPACELINE') {
      i++
      continue
    }
    let indent = 0
    if (t.kind === 'SPACELIST') {
      indent = t.text.length
      i++
      const after = peek()
      if (after.kind === 'NL' || after.kind === 'EOF') continue
    }
    const head = peek()
    if (head.kind === 'ICON' || head.kind === 'CLASS') {
      i++
      decorate(head)
    } else if (head.kind === 'NODE_ID' || head.kind === 'NODE_DSTART') {
      parseNode(indent)
    } else {
      throw fail(head, 'a node')
    }
    endOfStatement()
  }

  const kanban: Kanban = { columns }
  const init = extractInitConfig(
    stripFrontMatter(text.replace(/\r\n?/g, '\n')).split('\n'),
  )
  if (init.kanban && Object.keys(init.kanban).length > 0)
    kanban.config = init.kanban
  return kanban
}
