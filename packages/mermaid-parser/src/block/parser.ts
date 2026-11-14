import {
  MermaidParseError,
  decodeMermaidEntities,
  stripFrontMatter,
} from '@zombie-mermaid/core'
import type { BlockDiagram, BlockNode, BlockShape } from './types.ts'

// ============================================================================
// Block diagram parser
//
// A port of the subset of Mermaid's block grammar (mermaid-js/mermaid
// packages/mermaid/src/diagrams/block/parser/block.jison and blockDB.ts, as
// shipped in mermaid 12.3.0) that the SVG and ASCII renderers draw:
//
//   block-beta | block               the header (`block` alone also starts a group)
//     columns 3 | columns auto       columns of the enclosing group
//     a  b["text"]  c("text")        blocks: square, round (text must be quoted)
//     d:2  e["wide"]:2               span 2 columns
//     space  space:2                 empty cells
//     block:g:2 ... end              a group (own `columns`), spanning 2 columns
//     block ... end                  an anonymous group
//
// Rules taken from Mermaid's lexer, which is jison (the first matching rule
// wins, in order): whitespace and newlines only separate tokens, ids may not
// contain `( [ ) { } - < > : =` or whitespace, `end` and `block` need a word
// boundary (`endpoint` is an id), a label in `[ ]` or `( )` must be a quoted
// string with no space before the quote, and a repeated id changes the first
// block's type and label instead of adding a block.
//
// Not supported yet, and rejected with an error naming the issue: links
// (#3105), the other shapes and block arrows (#3106), classDef, class, style
// and markdown strings (#3107).
// ============================================================================

const SYNTAX_HELP =
  'A block diagram is `block-beta` followed by `columns N`, blocks (`id`, `id["text"]`, `id("text")`, `id:2`), `space` and `block:id ... end` groups.'

type TokenKind =
  | 'BLOCK'
  | 'BLOCKID'
  | 'END'
  | 'COLUMNS'
  | 'SPACE'
  | 'ID'
  | 'SIZE'
  | 'NODE'
  | 'EOF'

interface Token {
  kind: TokenKind
  text: string
  /** `COLUMNS` / `SPACE` / `SIZE`: the number (`COLUMNS` -1 is `auto`). */
  num?: number
  /** `NODE`: the label and the opening + closing delimiters. */
  label?: string
  typeStr?: string
  line: number
}

/** Shape start tokens in Mermaid's rule order (first match wins), then `<[`. */
const SHAPE_STARTS = [
  '-)',
  '(-',
  '))',
  ')',
  '(((',
  '((',
  '{{',
  '{',
  '>',
  '([',
  '(',
  '[[',
  '[|',
  '[(',
  ')))',
  '[\\',
  '[/',
  '[',
  '<[',
]

/** Shape end tokens in Mermaid's rule order. */
const SHAPE_ENDS = [
  '(((',
  ')))',
  '))',
  '}}',
  '}',
  '(-',
  '-)',
  '((',
  ']]',
  '(',
  '])',
  '\\]',
  '/]',
  ')]',
  ')',
  ']>',
  ']',
]

/** Node ids: Mermaid's `[^\(\[\n\-\)\{\}\s\<\>:=]+`. */
const ID_RE = /[^([\n\-){}\s<>:=]+/y
const LINK_RES = [
  /\s*[xo<]?--+[-xo>]\s*/y,
  /\s*[xo<]?==+[=xo>]\s*/y,
  /\s*[xo<]?-?\.+-[xo>]?\s*/y,
  /\s*~~[~]+\s*/y,
  /\s*[xo<]?--\s*/y,
  /\s*[xo<]?==\s*/y,
  /\s*[xo<]?-\.\s*/y,
]

/** Mermaid's `cleanupComments`: whole-line `%%` comments, then `%%{...}%%` directives, front matter. */
function preprocess(text: string): string {
  const unix = stripFrontMatter(text.replace(/\r\n?/g, '\n'))
  return unix
    .replace(/^\s*%%(?!\{)[^\n]+\n?/gm, '')
    .replace(/%{2}{[\s\S]*?}%{2}/g, (d) => d.replace(/[^\n]/g, ''))
}

function parseError(
  lines: readonly string[],
  line: number,
  message: string,
  help: string = SYNTAX_HELP,
): MermaidParseError {
  const source = (lines[line - 1] ?? '').trim()
  return new MermaidParseError(
    `Line ${line}: ${message}${source ? ` in "${source}"` : ''}. ${help}`,
    { diagramType: 'block', line },
  )
}

const unsupported = (
  lines: readonly string[],
  line: number,
  what: string,
  issue: number,
): MermaidParseError =>
  parseError(
    lines,
    line,
    `${what} is not supported yet`,
    `Tracked in https://github.com/dfadler/zombie-mermaid/issues/${issue}`,
  )

function tokenize(source: string, lines: readonly string[]): Token[] {
  const tokens: Token[] = []
  let pos = 0
  let line = 1
  const rest = () => source.slice(pos)
  const advance = (text: string) => {
    for (const ch of text) if (ch === '\n') line++
    pos += text.length
  }
  const push = (t: Omit<Token, 'line'>) => tokens.push({ ...t, line })

  while (pos < source.length) {
    const here = rest()
    let m: RegExpExecArray | null
    if ((m = /^\s+/.exec(here)) !== null) {
      advance(m[0])
      continue
    }
    if ((m = /^block-beta\b/.exec(here)) !== null) {
      push({ kind: 'BLOCK', text: m[0] })
    } else if (here.startsWith('block:')) {
      push({ kind: 'BLOCKID', text: 'block:' })
      advance('block:')
      continue
    } else if ((m = /^block\b/.exec(here)) !== null) {
      push({ kind: 'BLOCK', text: m[0] })
    } else if ((m = /^columns\s+auto\b/.exec(here)) !== null) {
      push({ kind: 'COLUMNS', text: m[0], num: -1 })
    } else if ((m = /^columns\s+(\d+)/.exec(here)) !== null) {
      push({ kind: 'COLUMNS', text: m[0], num: Number(m[1]) })
    } else if (here.startsWith('"')) {
      throw parseError(lines, line, 'Unexpected a string')
    } else if ((m = /^space:(\d+)/.exec(here)) !== null) {
      push({ kind: 'SPACE', text: m[0], num: Number(m[1]) })
    } else if ((m = /^space\b/.exec(here)) !== null) {
      push({ kind: 'SPACE', text: m[0], num: 1 })
    } else if (/^(?:classDef|class|style)\s+/.test(here)) {
      throw unsupported(lines, line, 'classDef, class and style', 3107)
    } else if ((m = /^accTitle\s*:\s*[^\n]*/.exec(here)) !== null) {
      // Accessibility statements are handled before parsing; ignored here.
    } else if ((m = /^accDescr\s*:\s*[^\n]*/.exec(here)) !== null) {
      // Same.
    } else if ((m = /^accDescr\s*\{\s*[^}]*\}/.exec(here)) !== null) {
      // Same.
    } else if ((m = /^end\b\s*/.exec(here)) !== null) {
      push({ kind: 'END', text: 'end' })
    } else {
      const start = SHAPE_STARTS.find((s) => here.startsWith(s))
      if (start !== undefined) {
        if (start !== '(' && start !== '[')
          throw unsupported(
            lines,
            line,
            start === '<[' ? 'A block arrow' : `The "${start}" shape`,
            3106,
          )
        if (here[start.length] === '"' && here[start.length + 1] === '`')
          throw unsupported(lines, line, 'A markdown string', 3107)
        if (here[start.length] !== '"')
          throw parseError(
            lines,
            line,
            `Expected a quoted label after "${start}"`,
          )
        const close = here.indexOf('"', start.length + 1)
        if (close === -1) throw parseError(lines, line, 'Unterminated string')
        const label = here.slice(start.length + 1, close)
        const afterQuote = here.slice(close + 1)
        const end = SHAPE_ENDS.find((e) => afterQuote.startsWith(e))
        if (end === undefined)
          throw parseError(
            lines,
            line,
            `Expected a closing bracket after "${label}"`,
          )
        const full = here.slice(0, close + 1 + end.length)
        push({ kind: 'NODE', text: full, label, typeStr: start + end })
        advance(full)
        continue
      }
      ID_RE.lastIndex = 0
      const id = ID_RE.exec(here)
      if (id !== null) {
        push({ kind: 'ID', text: id[0] })
        advance(id[0])
        continue
      }
      for (const re of LINK_RES) {
        re.lastIndex = 0
        if (re.exec(here) !== null)
          throw unsupported(lines, line, 'A link', 3105)
      }
      if ((m = /^:(\d+)/.exec(here)) !== null) {
        push({ kind: 'SIZE', text: m[0], num: Number(m[1]) })
      } else {
        throw parseError(lines, line, `Unexpected "${here.slice(0, 1)}"`)
      }
    }
    if (m === null) throw parseError(lines, line, 'Unexpected input')
    advance(m[0])
  }
  tokens.push({ kind: 'EOF', text: '', line })
  return tokens
}

/** Mermaid's `typeStr2Type` for the shapes drawn so far; others are rejected by the lexer. */
function shapeOf(typeStr: string | undefined): BlockShape | 'na' {
  if (typeStr === '[]') return 'square'
  if (typeStr === '()') return 'round'
  return 'na'
}

interface RawBlock {
  id: string
  label?: string
  /** Mermaid's `type`: `na` for a bare id. */
  type: BlockShape | 'na' | 'space' | 'composite'
  widthInColumns?: number
  /** Width of a `space` statement. */
  width?: number
  columns?: number
  children?: RawBlock[]
  columnSetting?: number
}

/**
 * Parse Mermaid `block` / `block-beta` source into a {@link BlockDiagram}.
 *
 * @throws MermaidParseError when Mermaid 12.3.0 would fail to parse the text,
 *   or the text uses syntax this port does not draw yet (named in the message).
 */
export function parseBlock(text: string): BlockDiagram {
  const source = preprocess(text)
  const lines = source.split('\n')
  const tokens = tokenize(source, lines)
  let i = 0
  const peek = () => tokens[i]!
  let anon = 0
  let spaces = 0

  const fail = (token: Token, expected: string): MermaidParseError =>
    parseError(
      lines,
      token.line,
      token.kind === 'EOF'
        ? `Unexpected end of input, expected ${expected}`
        : `Unexpected "${token.text.trim() || token.kind}", expected ${expected}`,
    )

  if (peek().kind !== 'BLOCK') throw fail(peek(), 'the "block-beta" header')
  i++

  /** `node` and its optional `:N` size, after an `ID` token. */
  const nodeStatement = (): RawBlock => {
    const id = peek()
    i++
    let label: string | undefined
    let type: RawBlock['type'] = 'na'
    if (peek().kind === 'NODE') {
      label = peek().label
      type = shapeOf(peek().typeStr)
      i++
    }
    const block: RawBlock = { id: id.text, type, widthInColumns: 1 }
    if (label !== undefined) block.label = label
    if (peek().kind === 'SIZE') {
      block.widthInColumns = peek().num!
      i++
    }
    return block
  }

  const document = (): RawBlock[] => {
    const out: RawBlock[] = []
    for (;;) {
      const t = peek()
      if (t.kind === 'END' || t.kind === 'EOF') return out
      if (t.kind === 'COLUMNS') {
        out.push({ id: '', type: 'na', columnSetting: t.num! })
        i++
      } else if (t.kind === 'SPACE') {
        i++
        out.push({
          id: `space-${++spaces}`,
          type: 'space',
          label: '',
          width: t.num!,
        })
      } else if (t.kind === 'BLOCKID') {
        i++
        if (peek().kind !== 'ID') throw fail(peek(), 'a block id')
        const head = nodeStatement()
        const children = document()
        if (peek().kind !== 'END') throw fail(peek(), '"end"')
        i++
        out.push({ ...head, type: 'composite', children })
      } else if (t.kind === 'BLOCK') {
        i++
        const children = document()
        if (peek().kind !== 'END') throw fail(peek(), '"end"')
        i++
        out.push({
          id: `block-${++anon}`,
          type: 'composite',
          label: '',
          children,
        })
      } else if (t.kind === 'ID') {
        out.push(nodeStatement())
      } else {
        throw fail(t, 'a block')
      }
    }
  }

  const list = document()
  if (peek().kind !== 'EOF') throw fail(peek(), 'the end of the diagram')

  // blockDB.populateBlockDatabase: later declarations of an id update the first.
  const db = new Map<string, RawBlock>()
  const root: RawBlock = { id: 'root', type: 'composite', columns: -1 }
  db.set('root', root)
  const populate = (blockList: RawBlock[], parent: RawBlock): void => {
    const children: RawBlock[] = []
    for (const block of blockList) {
      if (block.columnSetting !== undefined) {
        if (block.columnSetting === 0)
          throw new MermaidParseError(
            'Columns must be an integer !== 0. Use `columns auto` for no limit.',
            { diagramType: 'block' },
          )
        parent.columns = block.columnSetting
        continue
      }
      if (!block.label) block.label = block.type === 'composite' ? '' : block.id
      const existing = db.get(block.id)
      if (existing === undefined) db.set(block.id, block)
      else {
        if (block.type !== 'na') existing.type = block.type
        if (block.label !== block.id) existing.label = block.label
      }
      if (block.children) populate(block.children, block)
      if (block.type === 'space') {
        for (let j = 0; j < (block.width ?? 1); j++) {
          const clone: RawBlock = {
            ...block,
            id: `${block.id}-${j}`,
            widthInColumns: undefined,
          }
          db.set(clone.id, clone)
          children.push(clone)
        }
      } else if (existing === undefined) children.push(block)
    }
    parent.children = children
  }
  populate(list, root)

  const convert = (b: RawBlock): BlockNode => {
    const node: BlockNode = {
      id: b.id,
      type:
        b.type === 'space'
          ? 'space'
          : b.type === 'composite'
            ? 'composite'
            : 'node',
      label: decodeMermaidEntities(b.label ?? ''),
      shape: b.type === 'round' ? 'round' : 'square',
      widthInColumns: b.widthInColumns ?? 1,
      children: (b.children ?? []).map(convert),
    }
    if (b.columns !== undefined) node.columns = b.columns
    return node
  }
  return { root: convert(root) }
}
