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
 * Matches an HTML/XML character reference: `&amp;`, `&#35;`, `&#x1F600;`.
 *
 * These end in a semicolon that is part of the entity, not a statement
 * separator. Splitting one apart would corrupt the label containing it.
 */
const ENTITY_AT = /^&(?:#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/

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

    if (ch === '&' && ENTITY_AT.test(line.slice(i))) {
      // Copy the whole entity in one go so its trailing ';' can't be read
      // as a separator.
      const entity = ENTITY_AT.exec(line.slice(i))![0]
      current += entity
      i += entity.length - 1
      continue
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
    const line = rawLine.trim()
    if (line.length === 0 || line.startsWith('%%')) continue

    for (const part of splitOnSemicolons(line)) {
      const statement = part.trim()
      // Re-check for comments: `A-->B %% note` splits into a fragment that
      // begins a comment only after the semicolon pass.
      if (statement.length === 0 || statement.startsWith('%%')) continue
      statements.push(statement)
    }
  }

  return statements
}
