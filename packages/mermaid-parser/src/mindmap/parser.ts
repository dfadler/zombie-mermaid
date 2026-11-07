import {
  MermaidParseError,
  decodeMermaidEntities,
  stripFrontMatter,
} from '@zombie-mermaid/core'
import type { Mindmap, MindmapNode, MindmapShape } from './types.ts'

// ============================================================================
// Mindmap parser
//
// A port of Mermaid's mindmap grammar (mermaid-js/mermaid
// packages/mermaid/src/diagrams/mindmap/parser/mindmap.jison, as shipped in
// mermaid 12.3.0) and of `MindmapDB.addNode`. Mermaid lexes with jison: the
// first rule that matches wins (not the longest) and the rule set depends on
// the current state. The lexer below keeps those rules, in order, so the
// accepted language is the same, quirks included:
//
//   mindmap
//     root((text))        indentation sets the level, only relative to the
//       child             previous lines; the first node is the root
//       id[square] id(rounded) id((circle)) id)cloud( id))bang(( id{{hexagon}}
//       ::icon(fa fa-x)   decorates the node above (own line)
//       :::cls other      classes for the node above (own line; after a node
//                         on the same line Mermaid 12.3.0 fails to parse it)
//
//   - The text of a bare node, and the id in front of a delimiter, runs to the
//     next bracket or line end, so `B:::urgent` is a node *labelled*
//     `B:::urgent`. The id is never drawn: with a delimiter only the text
//     inside it is.
//   - Inside a delimiter the text runs to the next `)`, `]`, `(` or `}`; quote
//     it (`"..."` or ``"`...`"``) to put those in. A newline inside is a line
//     break.
//   - `::icon()` and `:::class` need a node above them.
//   - A node needs a parent: one at or above the root's indentation, or a
//     second root, is "There can be only one root".
//   - `mindmap` alone is a parse error; `mindmap` followed by blank lines is
//     an empty diagram, which Mermaid draws as nothing.
// ============================================================================

const SYNTAX_HELP =
  'A mindmap is `mindmap` followed by indented lines: `text`, `id[square]`, `id(rounded)`, `id((circle))`, `id)cloud(`, `id))bang((` or `id{{hexagon}}`; `::icon(...)` and `:::class` go on their own line under a node.'

type TokenKind =
  | 'MINDMAP'
  | 'SPACELINE'
  | 'NL'
  | 'SPACELIST'
  | 'ICON'
  | 'CLASS'
  | 'NODE_DSTART'
  | 'NODE_DESCR'
  | 'NODE_DEND'
  | 'NODE_ID'
  | 'EOF'

interface Token {
  kind: TokenKind
  text: string
  line: number
}

type LexState = 'INITIAL' | 'CLASS' | 'ICON' | 'NODE' | 'NSTR' | 'NSTR2'

/** Sticky and case-insensitive, like the jison rules. */
const r = (source: string): RegExp => new RegExp(source, 'iy')

/**
 * The jison lexer rules per state, in Mermaid's order. Each rule is
 * `[pattern, token kind (null: none), state to push or 'POP']`.
 */
const RULES: Record<
  LexState,
  [RegExp, TokenKind | null, LexState | 'POP' | undefined][]
> = {
  INITIAL: [
    [r('\\s*%%.*'), 'SPACELINE', undefined],
    [r('mindmap\\b'), 'MINDMAP', undefined],
    [r(':::'), null, 'CLASS'],
    [r('::icon\\('), null, 'ICON'],
    [r('\\s+\\n'), 'SPACELINE', undefined],
    [r('\\n+'), 'NL', undefined],
    [r('-\\)'), 'NODE_DSTART', 'NODE'],
    [r('\\(-'), 'NODE_DSTART', 'NODE'],
    [r('\\)\\)'), 'NODE_DSTART', 'NODE'],
    [r('\\)'), 'NODE_DSTART', 'NODE'],
    [r('\\(\\('), 'NODE_DSTART', 'NODE'],
    [r('\\{\\{'), 'NODE_DSTART', 'NODE'],
    [r('\\('), 'NODE_DSTART', 'NODE'],
    [r('\\['), 'NODE_DSTART', 'NODE'],
    [r('\\s+'), 'SPACELIST', undefined],
    [r('[^(\\[\\n){}]+'), 'NODE_ID', undefined],
    [r('$'), 'EOF', undefined],
  ],
  CLASS: [
    [r('.+'), 'CLASS', 'POP'],
    [r('\\n'), null, 'POP'],
  ],
  ICON: [
    [r('[^)]+'), 'ICON', undefined],
    [r('\\)'), null, 'POP'],
  ],
  NODE: [
    [r('"`'), null, 'NSTR2'],
    [r('"'), null, 'NSTR'],
    [r('\\)\\)'), 'NODE_DEND', 'POP'],
    [r('\\)'), 'NODE_DEND', 'POP'],
    [r('\\]'), 'NODE_DEND', 'POP'],
    [r('\\}\\}'), 'NODE_DEND', 'POP'],
    [r('\\(-'), 'NODE_DEND', 'POP'],
    [r('-\\)'), 'NODE_DEND', 'POP'],
    [r('\\(\\('), 'NODE_DEND', 'POP'],
    [r('\\('), 'NODE_DEND', 'POP'],
    [r('[^)\\](}]+'), 'NODE_DESCR', undefined],
    [r('.+(?!\\(\\()'), 'NODE_DESCR', undefined],
  ],
  NSTR2: [
    [r('[^`"]+'), 'NODE_DESCR', undefined],
    [r('`"'), null, 'POP'],
  ],
  NSTR: [
    [r('[^"]+'), 'NODE_DESCR', undefined],
    [r('"'), null, 'POP'],
  ],
}

const SHAPE_BY_START: Record<string, MindmapShape> = {
  '[': 'rect',
  '((': 'circle',
  ')': 'cloud',
  '))': 'bang',
  '{{': 'hexagon',
}

/** Mermaid's `getType(start, end)`. */
function shapeOf(start: string, end: string): MindmapShape {
  if (start === '(') return end === ')' ? 'rounded' : 'cloud'
  return SHAPE_BY_START[start] ?? 'default'
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
    { diagramType: 'mindmap', line },
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
    for (const [re, kind, next] of RULES[state]) {
      re.lastIndex = pos
      const m = re.exec(source)
      if (m === null) continue
      matched = true
      const text = m[0]
      if (kind === 'EOF') {
        tokens.push({ kind, text, line })
        return tokens
      }
      if (kind !== null) tokens.push({ kind, text, line })
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

/**
 * Parse Mermaid `mindmap` source into a typed {@link Mindmap}.
 *
 * @throws MermaidParseError when Mermaid 12.3.0 would fail to parse the text,
 * or finds a node with no parent.
 */
export function parseMindmap(text: string): Mindmap {
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

  while (peek().kind === 'SPACELINE' || peek().kind === 'NL') i++
  if (peek().kind !== 'MINDMAP') throw fail(peek(), 'the "mindmap" header')
  i++

  const nodes: MindmapNode[] = []
  let baseLevel = 0
  let last: MindmapNode | undefined

  const addNode = (
    rawLevel: number,
    descr: string,
    shape: MindmapShape,
    token: Token,
  ) => {
    let level = rawLevel
    if (nodes.length === 0) {
      baseLevel = rawLevel
      level = 0
    } else {
      level = rawLevel - baseLevel
    }
    const node: MindmapNode = {
      id: nodes.length,
      text: decodeMermaidEntities(descr),
      shape,
      level,
      children: [],
    }
    let parent: MindmapNode | undefined
    for (let k = nodes.length - 1; k >= 0; k--) {
      if (nodes[k]!.level < level) {
        parent = nodes[k]
        break
      }
    }
    if (parent === undefined && nodes.length > 0) {
      throw parseError(
        lines,
        token.line,
        `There can be only one root. No parent could be found for ("${node.text}")`,
      )
    }
    parent?.children.push(node)
    nodes.push(node)
    last = node
  }

  /** `node` of the grammar; returns after its last token. */
  const parseNode = (indent: number): void => {
    const first = peek()
    let id: string | undefined
    if (first.kind === 'NODE_ID') {
      id = first.text
      i++
    }
    if (peek().kind !== 'NODE_DSTART') {
      if (id === undefined) throw fail(first, 'a node')
      addNode(indent, id.trimEnd(), 'default', first)
      return
    }
    const open = tokens[i++]!
    const descr = peek()
    if (descr.kind !== 'NODE_DESCR') throw fail(descr, 'the node text')
    i++
    const close = peek()
    if (close.kind !== 'NODE_DEND') throw fail(close, 'a closing bracket')
    i++
    addNode(indent, descr.text, shapeOf(open.text, close.text), first)
  }

  const decorate = (token: Token): void => {
    // Mermaid 12.3.0 throws a TypeError for a decoration before the first node.
    if (last === undefined) {
      throw parseError(
        lines,
        token.line,
        `An ${token.kind === 'ICON' ? 'icon' : 'class'} needs a node above it`,
      )
    }
    if (token.kind === 'ICON') last.icon = token.text
    else last.className = token.text
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

  // `mindmap root` is allowed: the rest of the header line is a statement.
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
      if (
        after.kind === 'NL' ||
        after.kind === 'SPACELINE' ||
        after.kind === 'EOF'
      )
        continue
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

  const root = nodes[0]
  if (root === undefined) {
    throw parseError(lines, 1, 'A mindmap needs at least one node')
  }
  return { root }
}
