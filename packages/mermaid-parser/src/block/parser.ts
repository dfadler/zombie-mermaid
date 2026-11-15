import {
  MermaidParseError,
  decodeMermaidEntities,
  extractInitConfig,
  stripFrontMatter,
} from '@zombie-mermaid/core'
import type {
  BlockArrow,
  BlockDiagram,
  BlockEdge,
  BlockNode,
  BlockShape,
} from './types.ts'

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
//     a --> b  a -- "text" --> b     links between two blocks (`==>`, `-.-`,
//                                    `--x`, `--o`, `<-->`); both blocks are declared
//
//     classDef name fill:#f9f,...    a class; `class a,b name` applies it
//     style a fill:#969,stroke:#333  styles one block (it must be declared above)
//     %%{init: {"block": {"padding": 20}}}%% or front matter `config.block.padding`
//
// Markdown strings (`["`**bold**`"]`) are a parse error in Mermaid 12.3.0
// ("Expecting 'STR', got 'MD_STR'"), so they are one here too.
//
//     a("round")  a(("circle"))  a((("double circle")))  a{"diamond"}
//     a{{"hexagon"}}  a(["stadium"])  a[["subroutine"]]  a[("cylinder")]
//     a>"asymmetric"]  a[/"lean right"/]  a[\"lean left"\]
//     a[/"trapezoid"\]  a[\"inverted trapezoid"/]
//     a<["arrow"]>(right, down)      a block arrow; directions are `right`, `left`,
//                                    `up`, `down`, `x` (= right, left), `y` (= up, down)
//
// A pair of delimiters Mermaid has no shape for (`a("x"]`) is a plain block, as
// there. Mermaid keeps a space around a direction in its name (`(right down)`
// names "right " and "down"), and only exact names count, so that is `down`.
// ============================================================================

const SYNTAX_HELP =
  'A block diagram is `block-beta` followed by `columns N`, blocks (`id`, `id["text"]`, `id("text")`, `id{"text"}`, `id<["text"]>(right)`, `id:2`), `space` and `block:id ... end` groups.'

type TokenKind =
  | 'BLOCK'
  | 'BLOCKID'
  | 'END'
  | 'COLUMNS'
  | 'SPACE'
  | 'ID'
  | 'LINK'
  | 'CLASSDEF'
  | 'CLASS'
  | 'STYLE'
  | 'SIZE'
  | 'NODE'
  | 'EOF'

interface Token {
  kind: TokenKind
  text: string
  /** `COLUMNS` / `SPACE` / `SIZE`: the number (`COLUMNS` -1 is `auto`). */
  num?: number
  /** `CLASSDEF` / `CLASS` / `STYLE`: the id (or comma-separated ids) and the rest of the line. */
  ids?: string
  rest?: string
  /** `LINK`: the label of `-- "text" -->`. */
  linkLabel?: string
  /** `NODE`: the label and the opening + closing delimiters. */
  label?: string
  typeStr?: string
  /** `NODE` of a block arrow: the directions as Mermaid lexes them (`right`, `left`, `x`, `y`, `up`, `down`). */
  dirs?: string[]
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
/** Mermaid's LINK rules: `--->`, `===>`, `-.->`, each with an optional `x`, `o` or `<` start. */
const LINK_RES = [
  /^\s*[xo<]?--+[-xo>]\s*/,
  /^\s*[xo<]?==+[=xo>]\s*/,
  /^\s*[xo<]?-?\.+-[xo>]?\s*/,
]
/** Mermaid's START_LINK rules, which expect a quoted label and then a LINK. */
const START_LINK_RES = [
  /^\s*[xo<]?--\s*/,
  /^\s*[xo<]?==\s*/,
  /^\s*[xo<]?-\.\s*/,
]

/** Mermaid's ARROW_DIR rules, in order. */
const DIR_RES = [
  /^,?\s*right\s*/,
  /^,?\s*left\s*/,
  /^,?\s*x\s*/,
  /^,?\s*y\s*/,
  /^,?\s*up\s*/,
  /^,?\s*down\s*/,
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

const markdownString = (
  lines: readonly string[],
  line: number,
): MermaidParseError =>
  parseError(
    lines,
    line,
    "A markdown string is a parse error in Mermaid 12.3.0 (Expecting 'STR', got 'MD_STR')",
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
    } else if ((m = /^classDef\s+(\w+)\s+([^\n]*)/.exec(here)) !== null) {
      push({ kind: 'CLASSDEF', text: m[0], ids: m[1], rest: m[2]!.trim() })
    } else if (
      (m = /^class\s+(\w+(?:,\s*\w+)*)[ \t]*([^\n]*)/.exec(here)) !== null
    ) {
      push({ kind: 'CLASS', text: m[0], ids: m[1], rest: m[2]!.trim() })
    } else if (
      (m = /^style\s+(\w+(?:,\s*\w+)*)[ \t]*([^\n]*)/.exec(here)) !== null
    ) {
      push({ kind: 'STYLE', text: m[0], ids: m[1], rest: m[2]!.trim() })
    } else if (/^(?:classDef|class|style)\s+/.test(here)) {
      throw parseError(lines, line, 'Expected a name and style items')
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
        if (here[start.length] === '"' && here[start.length + 1] === '`')
          throw markdownString(lines, line)
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
        if (start === '<[') {
          // `<["text"]>(right, down)`: Mermaid's BLOCK_ARROW and ARROW_DIR states.
          const open = /^\]>\s*\(/.exec(afterQuote)
          if (open === null)
            throw parseError(
              lines,
              line,
              `Expected "]>(" with the arrow directions after "${label}"`,
            )
          let tail = afterQuote.slice(open[0].length)
          let used = open[0].length
          const dirs: string[] = []
          for (;;) {
            const dir = DIR_RES.map((re) => re.exec(tail)).find(
              (x) => x !== null,
            )
            if (!dir) break
            // Mermaid only drops a leading comma: a space before or after a word stays in the name.
            dirs.push(dir[0].replace(/^,\s*/, ''))
            tail = tail.slice(dir[0].length)
            used += dir[0].length
          }
          const closeParen = /^\)\s*/.exec(tail)
          if (closeParen === null)
            throw parseError(
              lines,
              line,
              'Expected a direction (right, left, up, down, x, y) or ")"',
            )
          if (dirs.length === 0)
            throw parseError(lines, line, 'Expected at least one direction')
          const full = here.slice(0, close + 1 + used + closeParen[0].length)
          push({ kind: 'NODE', text: full, label, typeStr: '<[]>', dirs })
          advance(full)
          continue
        }
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
      const link = LINK_RES.map((re) => re.exec(here)).find((x) => x !== null)
      if (link) {
        push({ kind: 'LINK', text: link[0], linkLabel: '' })
        advance(link[0])
        continue
      }
      const startLink = START_LINK_RES.map((re) => re.exec(here)).find(
        (x) => x !== null,
      )
      if (startLink) {
        // `-- "text" -->`: a quoted label, then the closing link (Mermaid's LLABEL state).
        const after = here.slice(startLink[0].length)
        if (after.startsWith('"`')) throw markdownString(lines, line)
        if (!after.startsWith('"'))
          throw parseError(lines, line, 'Expected a quoted link label')
        const close = after.indexOf('"', 1)
        if (close === -1) throw parseError(lines, line, 'Unterminated string')
        const label = after.slice(1, close)
        const end = LINK_RES.map((re) => re.exec(after.slice(close + 1))).find(
          (x) => x !== null,
        )
        if (!end)
          throw parseError(lines, line, `Expected a link after "${label}"`)
        const full = here.slice(
          0,
          startLink[0].length + close + 1 + end[0].length,
        )
        push({ kind: 'LINK', text: end[0], linkLabel: label })
        advance(full)
        continue
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

/** Mermaid's `typeStr2Type`: opening + closing delimiters to a shape; any other pair is a plain block (`na`). */
const SHAPE_OF: Record<string, BlockShape> = {
  '[]': 'square',
  '()': 'round',
  '(())': 'circle',
  '>]': 'rect_left_inv_arrow',
  '{}': 'diamond',
  '{{}}': 'hexagon',
  '([])': 'stadium',
  '[[]]': 'subroutine',
  '[()]': 'cylinder',
  '((()))': 'doublecircle',
  '[//]': 'lean_right',
  '[\\\\]': 'lean_left',
  '[/\\]': 'trapezoid',
  '[\\/]': 'inv_trapezoid',
  '<[]>': 'block_arrow',
}
const SHAPE_NAMES = new Set<string>(Object.values(SHAPE_OF))
const shapeOf = (typeStr: string | undefined): BlockShape | 'na' =>
  (typeStr !== undefined && SHAPE_OF[typeStr]) || 'na'

interface RawBlock {
  id: string
  label?: string
  /** Mermaid's `type`: `na` for a bare id. */
  type:
    | BlockShape
    | 'na'
    | 'space'
    | 'composite'
    | 'edge'
    | 'classDef'
    | 'applyClass'
    | 'applyStyles'
  widthInColumns?: number
  /** `block_arrow`: the directions. */
  directions?: string[]
  /** Width of a `space` statement. */
  width?: number
  columns?: number
  children?: RawBlock[]
  columnSetting?: number
  /** `edge`: the link. */
  edge?: Omit<BlockEdge, 'id'>
  /** `classDef` (`id`, `items`), `applyClass` (`ids`, `name`), `applyStyles` (`ids`, `items`). */
  ids?: string
  items?: string[]
  classes?: string[]
  styles?: string[]
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
    let directions: string[] | undefined
    let type: RawBlock['type'] = 'na'
    if (peek().kind === 'NODE') {
      label = peek().label
      directions = peek().dirs
      type = shapeOf(peek().typeStr)
      i++
    }
    const block: RawBlock = { id: id.text, type, widthInColumns: 1 }
    if (label !== undefined) block.label = label
    if (directions !== undefined) block.directions = directions
    if (peek().kind === 'SIZE') {
      block.widthInColumns = peek().num!
      i++
    }
    return block
  }

  /** `a link b`, after `a`: Mermaid's `node link node` (both blocks are declared). */
  const edgeStatement = (left: RawBlock): RawBlock[] => {
    const link = peek()
    i++
    if (peek().kind !== 'ID') throw fail(peek(), 'a block id')
    const right = nodeStatement()
    if (right.widthInColumns !== 1)
      throw fail(tokens[i - 1]!, 'the next statement')
    const t = link.text.trim()
    const last = t.slice(-1)
    const first = t.charAt(0)
    const arrow = (c: string, open: BlockArrow | 'arrow_open', tip: string) =>
      c === 'x'
        ? 'arrow_cross'
        : c === 'o'
          ? 'arrow_circle'
          : c === tip
            ? 'arrow_point'
            : open
    return [
      left,
      {
        id: `${left.id}-${right.id}`,
        type: 'edge',
        label: link.linkLabel ?? '',
        edge: {
          start: left.id,
          end: right.id,
          label: link.linkLabel ?? '',
          thickness: t.includes('==') ? 'thick' : 'normal',
          pattern: t.includes('.-') ? 'dotted' : 'solid',
          arrowTypeStart: arrow(
            first,
            'arrow_open',
            '<',
          ) as BlockEdge['arrowTypeStart'],
          arrowTypeEnd: arrow(last, '', '>') as BlockArrow,
        },
      },
      right,
    ]
  }

  const splitItems = (css: string): string[] =>
    css
      .split(',')
      .map((x) => x.replace(/([^;]*);/, '$1').trim())
      .filter((x) => x.includes(':'))

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
      } else if (t.kind === 'CLASSDEF') {
        i++
        out.push({
          id: t.ids!,
          type: 'classDef',
          items: splitItems(t.rest!.replace(/;$/, '')),
        })
      } else if (t.kind === 'CLASS' || t.kind === 'STYLE') {
        i++
        if (t.rest === '')
          throw parseError(
            lines,
            t.line,
            t.kind === 'CLASS'
              ? 'Expected a class name'
              : 'Expected style items',
          )
        out.push({
          id: t.ids!,
          type: t.kind === 'CLASS' ? 'applyClass' : 'applyStyles',
          ids: t.ids,
          items: t.kind === 'CLASS' ? [t.rest!] : splitItems(t.rest!),
          line: t.line,
        } as RawBlock)
      } else if (t.kind === 'ID') {
        const head = nodeStatement()
        if (peek().kind === 'LINK' && head.widthInColumns === 1)
          out.push(...edgeStatement(head))
        else out.push(head)
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
  const edges: BlockEdge[] = []
  const classDefs: Record<string, string[]> = {}
  const edgeCount = new Map<string, number>()
  const populate = (blockList: RawBlock[], parent: RawBlock): void => {
    const children: RawBlock[] = []
    for (const block of blockList) {
      if (block.type === 'classDef') {
        classDefs[block.id] = [...(classDefs[block.id] ?? []), ...block.items!]
        continue
      }
      if (block.type === 'applyClass') {
        for (const id of block.ids!.split(',')) {
          const target = db.get(id.trim())
          if (target) (target.classes ??= []).push(block.items![0]!)
        }
        continue
      }
      if (block.type === 'applyStyles') {
        const target = db.get(block.ids!.split(',')[0]!.trim())
        if (!target || block.ids!.includes(','))
          throw parseError(
            lines,
            (block as RawBlock & { line: number }).line,
            `Cannot style "${block.ids}": a block must be declared above its style statement`,
          )
        target.styles = block.items
        continue
      }
      if (block.type === 'edge') {
        const n = (edgeCount.get(block.id) ?? 0) + 1
        edgeCount.set(block.id, n)
        edges.push({ id: `${n}-${block.id}`, ...block.edge! })
        continue
      }
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
      shape: SHAPE_NAMES.has(b.type) ? (b.type as BlockShape) : 'square',
      directions: b.directions ?? [],
      widthInColumns: b.widthInColumns ?? 1,
      children: (b.children ?? []).map(convert),
      classes: b.classes ?? [],
      styles: b.styles ?? [],
    }
    if (b.columns !== undefined) node.columns = b.columns
    return node
  }
  const padding = extractInitConfig(
    stripFrontMatter(text.replace(/\r\n?/g, '\n')).split('\n'),
  ).block?.padding
  return { root: convert(root), edges, classDefs, padding: padding ?? 8 }
}
