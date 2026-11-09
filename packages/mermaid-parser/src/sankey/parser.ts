import { extractInitConfig, MermaidParseError } from '@zombie-mermaid/core'
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
  const body = rest.replace(/\n+/g, '\n').trim()
  if (body === '') {
    fail(headerLine, 'Expected rows of "source,target,value" after the header')
  }

  const nodes: string[] = []
  const seen = new Set<string>()
  const links: SankeyLink[] = []
  const node = (id: string): string => {
    if (!seen.has(id)) {
      seen.add(id)
      nodes.push(id)
    }
    return id
  }

  let pos = 0
  let line = headerLine + 1
  const field = (): string => {
    const start = pos
    if (body[pos] === '"') {
      pos++
      let out = ''
      for (;;) {
        const ch = body[pos]
        if (ch === undefined) fail(line, 'Unclosed quote')
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
          if (ch === '\n') line++
          out += ch
          pos++
          continue
        }
        fail(line, `Unexpected "${ch}" in a quoted field`)
      }
      if (out === '') fail(line, 'Empty field')
      return out.trim()
    }
    while (pos < body.length && PLAIN_CHAR.test(body[pos]!)) pos++
    if (pos === start) {
      const ch = body[pos]
      fail(
        line,
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
      line,
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
      fail(line, `The value "${raw}" is not a number`)
    }
    links.push({ source: node(s), target: node(t), value })
    if (pos < body.length) {
      expect('\n')
      line++
    }
  }

  assertAcyclic(nodes, links)

  const sankey: Sankey = { nodes, links }
  const init = extractInitConfig(text.split(/\r\n?|\n/))
  if (init.sankey) sankey.config = init.sankey
  return sankey
}

/** D3-sankey throws "circular link" when a node's depth passes the node count. */
function assertAcyclic(nodes: string[], links: SankeyLink[]): void {
  const indegree = new Map<string, number>(nodes.map((n) => [n, 0]))
  for (const l of links) indegree.set(l.target, indegree.get(l.target)! + 1)
  const queue = nodes.filter((n) => indegree.get(n) === 0)
  let visited = 0
  while (queue.length > 0) {
    const n = queue.pop()!
    visited++
    for (const l of links) {
      if (l.source !== n) continue
      const d = indegree.get(l.target)! - 1
      indegree.set(l.target, d)
      if (d === 0) queue.push(l.target)
    }
  }
  if (visited < nodes.length) {
    throw new MermaidParseError('circular link', { diagramType: 'sankey' })
  }
}
