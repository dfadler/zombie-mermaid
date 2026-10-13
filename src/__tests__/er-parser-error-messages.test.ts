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
import { splitStatements } from '@zombie-mermaid/core'

function parse(text: string) {
  return parseErDiagram(splitStatements(text))
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

// Cardinality matrix verified against mermaid.js 11.17.2 (#1747, #1748):
// every symbol is valid on either side of the line.
describe('parseErDiagram – cardinality pairs mermaid.js accepts (#1748)', () => {
  const SYMBOLS = {
    '||': 'one',
    '|o': 'zero-one',
    'o|': 'zero-one',
    '}o': 'zero-many',
    'o{': 'zero-many',
    '}|': 'many',
    '|{': 'many',
  } as const
  const LINES = { '--': true, '..': false, '.-': false, '-.': false } as const

  for (const [l, lc] of Object.entries(SYMBOLS)) {
    for (const [r, rc] of Object.entries(SYMBOLS)) {
      for (const [line, identifying] of Object.entries(LINES)) {
        it(`parses ${l}${line}${r}`, () => {
          const d = parse(`erDiagram\n  A ${l}${line}${r} B : x`)
          expect(d.relationships).toEqual([
            {
              entity1: 'A',
              entity2: 'B',
              cardinality1: lc,
              cardinality2: rc,
              label: 'x',
              identifying,
            },
          ])
        })
      }
    }
  }
})

describe('parseErDiagram – word-form cardinalities (#1747)', () => {
  it.each([
    ['one to many', 'one', 'zero-many', true],
    ['1 to 0+', 'one', 'zero-many', true],
    ['only one to zero or more', 'one', 'zero-many', true],
    ['zero or one to one or more', 'zero-one', 'many', true],
    ['one or zero optionally to many(0)', 'zero-one', 'zero-many', false],
    ['many(1) optionally to 1+', 'many', 'many', false],
    ['ONE TO MANY', 'one', 'zero-many', true],
  ])('parses "%s"', (spec, c1, c2, identifying) => {
    const d = parse(`erDiagram\n  A ${spec} B : x`)
    expect(d.relationships).toHaveLength(1)
    expect(d.relationships[0]).toMatchObject({
      entity1: 'A',
      entity2: 'B',
      cardinality1: c1,
      cardinality2: c2,
      identifying,
    })
  })

  it('does not treat a click tooltip containing "to" as a relationship', () => {
    expect(() =>
      parse(`erDiagram\n  A ||--o{ B : x\n  click A "u" "Go to page"`),
    ).not.toThrow()
  })
})

describe('parseErDiagram – relationship lines are never silently dropped (#1747)', () => {
  it.each([
    '||-||',
    '||==o{',
    '||--',
    '--||',
    '||o{',
    '||---o{',
    'one to',
    '|--||',
  ])('throws a line-level error for "%s"', (spec) => {
    expect(() =>
      parse(`erDiagram\n  A ||--o{ C : ok\n  A ${spec} B : x`),
    ).toThrow(/^Line 3: Invalid ER relationship cardinality/)
  })
})
