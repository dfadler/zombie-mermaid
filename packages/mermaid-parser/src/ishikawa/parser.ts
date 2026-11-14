import { MermaidParseError } from '@zombie-mermaid/core'
import { sanitizeTitle } from '../sanitize-title.ts'
import type { Ishikawa, IshikawaNode } from './types.ts'

// ============================================================================
// Ishikawa parser
//
// A port of Mermaid's ishikawa jison grammar and db (mermaid-js/mermaid
// packages/mermaid/src/diagrams/ishikawa/{parser/ishikawa.jison,ishikawaDb.ts},
// mermaid@12.3.0):
//
//   ishikawa | ishikawa-beta
//       <effect>
//       <category>
//           <cause>
//               <sub-cause>
//
// Rules taken from Mermaid:
//   - The header is case-insensitive (`/ishikawa(-beta)?\b/i`); text after it
//     on the same line is the first node.
//   - Every non-blank line is one node; the first is the root (the effect).
//   - A line's depth is its indentation (every whitespace character counts
//     one) relative to the first line under the root, which is depth 1;
//     anything shallower than that is depth 1 too. A node attaches to the
//     nearest earlier node that is shallower, so skipped levels are fine.
//   - A line whose first non-blank characters are `%%` is a comment.
//   - `;` is not a separator. A label goes through Mermaid's HTML sanitizer
//     (see sanitize-title.ts), so `<x>` disappears and `&` is kept as `&amp;`;
//     `<br>` breaks a label at render time.
//   - Not ported: Mermaid's grammar rejects a header with trailing spaces, a
//     header with no newline after it and some blank lines straight after the
//     header; this parser accepts them. `accTitle` / `accDescr` lines are
//     stripped by the front door, where Mermaid would draw them as causes.
// ============================================================================

/** Anything the jison lexer would read as a comment line. */
const COMMENT = /^\s*%%/

/** Parse Mermaid `ishikawa` source text. */
export function parseIshikawa(text: string): Ishikawa {
  const lines = text.split(/\r?\n/)
  let i = 0
  // Skip blank and comment lines (and a `%%{init}%%` directive) before the header.
  while (
    i < lines.length &&
    (lines[i]!.trim() === '' || COMMENT.test(lines[i]!))
  )
    i++
  const header = /^\s*ishikawa(?:-beta)?\b/i.exec(lines[i] ?? '')
  if (!header)
    throw new MermaidParseError(
      'Invalid ishikawa header: expected "ishikawa" or "ishikawa-beta"',
      { line: i + 1, diagramType: 'ishikawa' },
    )

  let root: IshikawaNode | undefined
  let stack: Array<{ level: number; node: IshikawaNode }> = []
  let baseLevel: number | undefined

  const add = (indent: number, raw: string): void => {
    const node: IshikawaNode = { text: sanitizeTitle(raw.trim()), children: [] }
    if (!root) {
      root = node
      stack = [{ level: 0, node }]
      return
    }
    baseLevel ??= indent
    const level = Math.max(1, indent - baseLevel + 1)
    while (stack.length > 1 && stack[stack.length - 1]!.level >= level)
      stack.pop()
    stack[stack.length - 1]!.node.children.push(node)
    stack.push({ level, node })
  }

  const rest = lines[i]!.slice(header[0].length)
  const lead = /^\s*/.exec(rest)![0].length
  if (rest.trim() !== '' && !COMMENT.test(rest)) add(lead, rest)
  for (i++; i < lines.length; i++) {
    const line = lines[i]!
    if (line.trim() === '' || COMMENT.test(line)) continue
    add(/^\s*/.exec(line)![0].length, line)
  }
  return { root }
}
