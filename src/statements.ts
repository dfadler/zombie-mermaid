// ============================================================================
// zombie-mermaid — shared statement splitting
//
// Every parser entry point (flowchart/state in src/parser.ts, the four
// specialized parsers dispatched from src/index.ts and src/ascii/index.ts)
// needs the same thing: turn raw Mermaid source into a list of trimmed,
// comment-free statements. They each used to do it inline with
// `.split('\n').map(trim).filter(...)`, which meant semicolon separators —
// valid Mermaid, and the form `detectDiagramType` already assumed when
// isolating the header — were understood by nobody.
//
// This module is the single source of truth for "what counts as one
// statement".
// ============================================================================

/**
 * Matches a character reference in either spelling Mermaid accepts.
 *
 * HTML/XML form: `&amp;`, `&#35;`, `&#x1F600;`.
 * Mermaid's own form, which uses `#` where HTML uses `&`: `#59;`, `#9829;`,
 * `#quot;` — the documented way to put a literal semicolon, quote, or symbol
 * into a label.
 *
 * Both end in a semicolon that belongs to the reference, not to statement
 * separation. Splitting one apart corrupts the label *and* invents a
 * statement out of the remainder.
 */
const ENTITY_AT = /^[&#](?:#?[0-9]+|#?[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/

/** Characters that can open a character reference. */
const ENTITY_STARTERS = new Set(['&', '#'])

/**
 * Index of the `%%` that starts a comment on this line, or -1.
 *
 * A Mermaid comment runs to the end of the line, so everything after it —
 * including any further `;`-separated fragments — is commented out. Scanning
 * for it before splitting is what makes that true: dropping fragments that
 * merely *begin* with `%%` afterwards leaves `graph TD; A-->B; %% note; C-->D`
 * still parsing `C-->D` as code.
 *
 * Quote- and reference-aware for the same reasons the splitter is, so a `%%`
 * inside a label is text rather than a comment marker.
 */
function commentStart(line: string): number {
  let quote: '"' | "'" | null = null

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!

    if (quote !== null) {
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (ENTITY_STARTERS.has(ch)) {
      const entity = ENTITY_AT.exec(line.slice(i))
      if (entity) {
        i += entity[0].length - 1
        continue
      }
    }
    if (ch === '%' && line[i + 1] === '%') return i
  }

  return -1
}

/**
 * Split one already-newline-separated line on its statement-separating
 * semicolons.
 *
 * A semicolon separates statements unless it is:
 *   - inside a quoted string (`A["a; b"]`), or
 *   - the terminator of a character reference (`A[&amp;]`).
 *
 * Quote tracking is deliberately simple — Mermaid has no escape sequence
 * inside quoted labels, so a quote character always opens or closes a span.
 */
function splitOnSemicolons(line: string): string[] {
  const parts: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!

    if (quote !== null) {
      current += ch
      if (ch === quote) quote = null
      continue
    }

    if (ch === '"' || ch === "'") {
      quote = ch
      current += ch
      continue
    }

    if (ENTITY_STARTERS.has(ch)) {
      // Copy a whole character reference in one go so its trailing ';' can't
      // be read as a separator. Guarded on '#' as well as '&': Mermaid's own
      // `#59;` spelling is far more common in diagrams than the HTML one.
      const entity = ENTITY_AT.exec(line.slice(i))
      if (entity) {
        current += entity[0]
        i += entity[0].length - 1
        continue
      }
    }

    if (ch === ';') {
      parts.push(current)
      current = ''
      continue
    }

    current += ch
  }

  parts.push(current)
  return parts
}

/**
 * Split Mermaid source into trimmed statements, dropping blank lines and
 * `%%` comment lines.
 *
 * Newlines and semicolons both separate statements, matching Mermaid's own
 * `graph TD; A-->B;` form. Comments are removed *before* semicolon splitting
 * so that a `;` inside a comment can't resurrect the rest of that line as
 * code.
 */
export function splitStatements(text: string): string[] {
  const statements: string[] = []

  for (const rawLine of text.split('\n')) {
    let line = rawLine.trim()

    /*
     * Cut the comment off first. A Mermaid comment runs to end of line, so
     * anything after `%%` is commented out — including further `;`-separated
     * fragments. Splitting first and discarding fragments that start with
     * `%%` would leave `A-->B; %% note; C-->D` parsing `C-->D` as code.
     */
    const comment = commentStart(line)
    if (comment !== -1) line = line.slice(0, comment).trim()
    if (line.length === 0) continue

    for (const part of splitOnSemicolons(line)) {
      const statement = part.trim()
      if (statement.length === 0) continue
      statements.push(statement)
    }
  }

  return statements
}
