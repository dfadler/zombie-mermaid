/**
 * Error-message quality tests for the ER diagram parser (issue #541).
 *
 * Before this pass, `parseErDiagram` had zero `throw`/`Error` statements in
 * the entire file (see docs/parser-error-audit-541.md): a relationship line
 * with invalid cardinality tokens or a missing `: label` silently dropped
 * the *entire* line — both entities included — with no indication anything
 * was wrong. These tests assert the parser now throws an actionable error
 * instead, while confirming valid syntax and genuinely unrelated lines
 * (e.g. `click`, which ER's own grammar has no directive for) are
 * unaffected.
 */
import { describe, it, expect } from 'vitest'
import { parseErDiagram } from '@zombie-mermaid/mermaid-parser'

function parse(text: string) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('%%'))
  return parseErDiagram(lines)
}

describe('parseErDiagram – invalid cardinality tokens', () => {
  it('throws on non-crow-foot cardinality characters', () => {
    expect(() =>
      parse(`erDiagram
        CUSTOMER ??--?? ORDER : places`),
    ).toThrow(/Invalid ER relationship cardinality "\?\?--\?\?"/)
  })

  it('throws on a left-side cardinality that is not one of the four valid tokens', () => {
    expect(() =>
      parse(`erDiagram
        CUSTOMER |--|| ORDER : places`),
    ).toThrow(/Invalid ER relationship cardinality "\|--\|\|"/)
  })

  it('mentions the valid cardinality tokens in the message', () => {
    expect(() =>
      parse(`erDiagram
        CUSTOMER ??--?? ORDER : places`),
    ).toThrow(/\|\|, \|o, \}\|, \}o/)
  })
})

describe('parseErDiagram – missing relationship label', () => {
  it('throws when the colon has no label after it', () => {
    expect(() =>
      parse(`erDiagram
        CUSTOMER ||--o{ ORDER :`),
    ).toThrow(/missing a ": label"/)
  })

  it('throws when there is no colon at all', () => {
    expect(() =>
      parse(`erDiagram
        CUSTOMER ||--o{ ORDER`),
    ).toThrow(/missing a ": label"/)
  })
})

describe('parseErDiagram – valid syntax and unrelated lines are unaffected', () => {
  it('still parses a fully valid relationship without throwing', () => {
    const d = parse(`erDiagram
      CUSTOMER ||--o{ ORDER : places`)
    expect(d.relationships).toHaveLength(1)
    expect(d.entities.map((e) => e.id).sort()).toEqual(['CUSTOMER', 'ORDER'])
  })

  it('does not throw for a click line (no ER click grammar; see er-click-unsupported.test.ts)', () => {
    expect(() =>
      parse(`erDiagram
        CUSTOMER ||--o{ ORDER : places
        click CUSTOMER "https://example.com" "Tooltip"`),
    ).not.toThrow()
  })

  it('does not throw for a standalone entity name with no relationship or block', () => {
    expect(() =>
      parse(`erDiagram
        CUSTOMER`),
    ).not.toThrow()
  })
})
