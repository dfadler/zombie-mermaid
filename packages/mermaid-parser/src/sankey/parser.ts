import { extractInitConfig, MermaidParseError } from '@zombie-mermaid/core'
import { sanitizeTitle } from '../sanitize-title.ts'
import type { Sankey, SankeyLink } from './types.ts'

// ============================================================================
// Sankey parser
//
// A port of Mermaid's jison lexer and grammar (mermaid-js/mermaid
// packages/mermaid/src/diagrams/sankey/parser/sankey.jison and sankeyDB.ts,
// checked against mermaid@12.3.0):
//
//   sankey-beta            (or `sankey`, any case)
//   source,target,value
//   "quoted, ""field""",target,value
//
// Rules taken from Mermaid:
//   - The header is followed by a newline and at least one row.
//   - Surrounding blank space and runs of newlines are dropped before parsing;
//     `%%` comment lines and `%%{init}%%` directives are removed earlier.
//   - A row is exactly three fields. A field is unquoted text without `,` or
//     `"`, or `"` ... `"` with `""` for a quote and `,` or newlines allowed
//     inside. Neither may be empty, and both are limited to printable ASCII
//     (Mermaid's lexer rejects anything else, even inside quotes).
//   - Fields are trimmed. The value is `parseFloat`, so `1e3` and `5x` read as
//     1000 and 5; Mermaid draws a text value as `NaN`, here it is an error.
//   - A node is created the first time its id is seen, source before target.
//   - A cycle (including a node linked to itself) is "circular link".
//   - accTitle/accDescr are not part of the grammar. They are stripped by
//     `extractAccessibility` before the renderers call this.
// ============================================================================

const HEADER = /^sankey(?:-beta)?\b/i
const DIRECTIVE = /%%\{[\s\S]*?\}%%/g
const COMMENT = /^[ \t]*%%(?!\{)[^\n]*\n?/gm
// Mermaid's NON_ESCAPED_TEXT and ESCAPED_TEXT character classes.
const PLAIN_CHAR = /[ !#-+\--~]/

function fail(line: number, message: string): never {
  throw new MermaidParseError(`Line ${line}: ${message}`, {
    diagramType: 'sankey',
  })
}

/** Parse Mermaid `sankey-beta` source into a typed {@link Sankey}. */
export function parseSankey(text: string): Sankey {
  let source = text.replace(/\r\n?/g, '\n')
  // Front matter, then directives and comments, as Mermaid removes them.
  const fm = /^\s*---\n[\s\S]*?\n---[ \t]*(?:\n|$)/.exec(source)
  if (fm) source = fm[0].replace(/[^\n]/g, '') + source.slice(fm[0].length)
  source = source
    .replace(DIRECTIVE, (d) => d.replace(/[^\n]/g, ''))
    .replace(COMMENT, (c) => (c.endsWith('\n') ? '\n' : ''))

  const lead = /^\s*/.exec(source)![0]
  const header = HEADER.exec(source.slice(lead.length))
  if (!header) {
    fail(1, 'Expected the "sankey-beta" header')
  }
  const afterHeader = lead.length + header[0].length
  const headerLine =
    1 + (source.slice(0, lead.length).match(/\n/g)?.length ?? 0)
  // Mermaid's prepareTextForParsing, applied to what follows the header: rows
  // are separated by single newlines and edge whitespace is gone.
  const rest = source.slice(afterHeader)
  if (!rest.startsWith('\n')) {
    fail(headerLine, 'The "sankey-beta" header must be followed by a new line')
  }
  // Collapse runs of newlines, remembering each kept character's line in the
  // caller's source so errors point at the real row.
  const restLine = headerLine
  let collapsed = ''
  const lineAt: number[] = []
  let cur = restLine
  for (const ch of rest) {
    if (ch === '\n') {
      cur++
      if (collapsed.endsWith('\n')) continue
    }
    collapsed += ch
    lineAt.push(ch === '\n' ? cur - 1 : cur)
  }
  const lead2 = collapsed.length - collapsed.trimStart().length
  const body = collapsed.trim()
  lineAt.splice(0, lead2)
  if (body === '') {
    fail(headerLine, 'Expected rows of "source,target,value" after the header')
  }

  const nodes: string[] = []
  const seen = new Set<string>()
  const links: SankeyLink[] = []
  // sankeyDB's findOrCreateNode runs the name through DOMPurify (common
  // sanitizeText); names that sanitise alike are one node.
  const node = (name: string): string => {
    const id = sanitizeTitle(name)
    if (!seen.has(id)) {
      seen.add(id)
      nodes.push(id)
    }
    return id
  }

  let pos = 0
  const ln = (): number =>
    lineAt[Math.min(pos, lineAt.length - 1)] ?? headerLine
  const field = (): string => {
    const start = pos
    if (body[pos] === '"') {
      pos++
      let out = ''
      for (;;) {
        const ch = body[pos]
        if (ch === undefined) fail(ln(), 'Unclosed quote')
        if (ch === '"') {
          if (body[pos + 1] === '"') {
            out += '"'
            pos += 2
            continue
          }
          pos++
          break
        }
        if (ch === ',' || ch === '\n' || PLAIN_CHAR.test(ch)) {
          out += ch
          pos++
          continue
        }
        fail(ln(), `Unexpected "${ch}" in a quoted field`)
      }
      if (out === '') fail(ln(), 'Empty field')
      return out.trim()
    }
    while (pos < body.length && PLAIN_CHAR.test(body[pos]!)) pos++
    if (pos === start) {
      const ch = body[pos]
      fail(
        ln(),
        ch === undefined
          ? 'Expected a field'
          : ch === ','
            ? 'Empty field'
            : `Unexpected "${ch === '\n' ? '\\n' : ch}"`,
      )
    }
    return body.slice(start, pos).trim()
  }
  const expect = (ch: ',' | '\n' | ''): void => {
    if (ch === '' ? pos >= body.length : body[pos] === ch) {
      pos += ch === '' ? 0 : 1
      return
    }
    const found = body[pos]
    fail(
      ln(),
      `Expected ${ch === ',' ? '","' : 'the end of the row'} after the field${
        found === undefined ? '' : `, found "${found}"`
      } (a row is source,target,value)`,
    )
  }

  while (pos < body.length) {
    const s = field()
    expect(',')
    const t = field()
    expect(',')
    const raw = field()
    const value = parseFloat(raw)
    if (!Number.isFinite(value)) {
      fail(ln(), `The value "${raw}" is not a number`)
    }
    links.push({ source: node(s), target: node(t), value })
    if (pos < body.length) expect('\n')
  }

  assertAcyclic(nodes, links)
  assertDrawable(nodes, links)

  const sankey: Sankey = { nodes, links }
  const init = extractInitConfig(text.split(/\r\n?|\n/))
  if (init.sankey) sankey.config = init.sankey
  return sankey
}

/** D3-sankey throws "circular link" when a node's depth passes the node count. */
function assertAcyclic(nodes: string[], links: SankeyLink[]): void {
  const out = new Map<string, string[]>(nodes.map((n) => [n, []]))
  const indegree = new Map<string, number>(nodes.map((n) => [n, 0]))
  for (const l of links) {
    out.get(l.source)!.push(l.target)
    indegree.set(l.target, indegree.get(l.target)! + 1)
  }
  const queue = nodes.filter((n) => indegree.get(n) === 0)
  let visited = 0
  while (queue.length > 0) {
    const n = queue.pop()!
    visited++
    for (const t of out.get(n)!) {
      const d = indegree.get(t)! - 1
      indegree.set(t, d)
      if (d === 0) queue.push(t)
    }
  }
  if (visited < nodes.length) {
    throw new MermaidParseError('circular link', { diagramType: 'sankey' })
  }
}

/**
 * Mermaid draws `NaN` geometry when every flow is zero or a node's total
 * overflows to Infinity; both are errors here.
 */
function assertDrawable(nodes: string[], links: SankeyLink[]): void {
  if (!links.some((l) => l.value > 0)) {
    throw new MermaidParseError('A sankey needs at least one positive flow', {
      diagramType: 'sankey',
    })
  }
  const into = new Map<string, number>(nodes.map((n) => [n, 0]))
  const from = new Map<string, number>(nodes.map((n) => [n, 0]))
  for (const l of links) {
    from.set(l.source, from.get(l.source)! + l.value)
    into.set(l.target, into.get(l.target)! + l.value)
  }
  for (const n of nodes) {
    if (!Number.isFinite(from.get(n)!) || !Number.isFinite(into.get(n)!)) {
      throw new MermaidParseError(
        `The flows of "${n}" add up to more than a number can hold`,
        {
          diagramType: 'sankey',
        },
      )
    }
  }
}
