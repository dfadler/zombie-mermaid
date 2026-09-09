/**
 * Error-message quality tests for the class diagram parser (issue #761).
 *
 * Before this pass, `parseClassDiagram` had zero `throw`/`Error` statements
 * in the entire file — the only one of the five diagram parsers still in
 * that state after #722 added targeted throws to ER and xychart-beta. A
 * dangling relationship arrow with no target, an unclosed `class X { ... }`
 * body, an unclosed method-signature paren, or a malformed `<<...>>`
 * annotation were all silently dropped or silently mis-parsed, with no
 * indication anything was wrong. These tests assert the parser now throws
 * an actionable error instead, while confirming valid syntax and genuinely
 * unrelated lines are unaffected — mirroring #722's "attempt, then
 * validate" scoping so a line with no relationship-arrow token at all still
 * falls through silently.
 */
import { describe, it, expect } from 'vitest'
import { parseClassDiagram } from '@zombie-mermaid/mermaid-parser'
import { splitStatements } from '@zombie-mermaid/core'

function parse(text: string) {
  return parseClassDiagram(splitStatements(text))
}

describe('parseClassDiagram – malformed relationships', () => {
  it('throws on a dangling relationship arrow with no target', () => {
    expect(() =>
      parse(`classDiagram
        Animal <|--`),
    ).toThrow(/Malformed class-diagram relationship "Animal <\|--"/)
  })

  it('throws on an unsupported/garbage arrow shape', () => {
    expect(() =>
      parse(`classDiagram
        Animal <>-- Dog`),
    ).toThrow(/Malformed class-diagram relationship/)
  })

  it('mentions the valid arrow tokens in the message', () => {
    expect(() =>
      parse(`classDiagram
        Animal <|--`),
    ).toThrow(/<\|--, <\|\.\., \*--, o--, -->/)
  })

  it('reports the 1-based line number', () => {
    expect(() =>
      parse(`classDiagram
        class Animal
        Animal <|--`),
    ).toThrow(/^Line 3:/)
  })
})

describe('parseClassDiagram – unclosed class body', () => {
  it('throws when a class block is never closed before the diagram ends', () => {
    expect(() =>
      parse(`classDiagram
        class Animal {
          +String name`),
    ).toThrow(/Unclosed class body for "Animal"/)
  })

  it('reports the line the class body opened on, not where the diagram ends', () => {
    expect(() =>
      parse(`classDiagram
        class Animal {
          +String name
          +eat() void`),
    ).toThrow(/^Line 2:/)
  })
})

describe('parseClassDiagram – malformed method signatures', () => {
  it('throws on an unclosed "(" in a method signature', () => {
    expect(() =>
      parse(`classDiagram
        class Animal {
          +eat(void
        }`),
    ).toThrow(/unclosed "\(" in a method signature/)
  })

  it('throws for the same case on a single-line inline body', () => {
    expect(() => parse('classDiagram\nclass Animal { +eat(void }')).toThrow(
      /unclosed "\(" in a method signature/,
    )
  })
})

describe('parseClassDiagram – malformed annotations', () => {
  it('throws on a multi-line-body annotation missing its closing ">>"', () => {
    expect(() =>
      parse(`classDiagram
        class Shape {
          <<abstract
        }`),
    ).toThrow(/Malformed class annotation "<<abstract"/)
  })

  it('throws on an inline-body annotation missing its closing ">>"', () => {
    expect(() => parse('classDiagram\nclass Shape { <<abstract }')).toThrow(
      /Malformed class annotation/,
    )
  })
})

describe('parseClassDiagram – valid syntax is unaffected', () => {
  it('still parses a fully valid relationship without throwing', () => {
    const d = parse(`classDiagram
      Animal <|-- Dog`)
    expect(d.relationships).toHaveLength(1)
    expect(d.classes.map((c) => c.id).sort()).toEqual(['Animal', 'Dog'])
  })

  it('still parses a closed class body with a valid method and annotation', () => {
    const d = parse(`classDiagram
      class Animal {
        <<abstract>>
        +String name
        +eat() void
      }`)
    const animal = d.classes.find((c) => c.id === 'Animal')!
    expect(animal.annotation).toBe('abstract')
    expect(animal.attributes).toHaveLength(1)
    expect(animal.methods).toHaveLength(1)
  })

  it('still parses a valid inline single-line body', () => {
    const d = parse('classDiagram\nclass Shape { <<interface>> }')
    expect(d.classes[0]!.annotation).toBe('interface')
  })

  it('still parses a valid cardinality + label relationship', () => {
    const d = parse('classDiagram\nA "1" --> "*" B : uses')
    expect(d.relationships[0]!.fromCardinality).toBe('1')
    expect(d.relationships[0]!.toCardinality).toBe('*')
    expect(d.relationships[0]!.label).toBe('uses')
  })

  it('does not throw for a standalone class declaration with no relationship or body', () => {
    expect(() =>
      parse(`classDiagram
        class Animal`),
    ).not.toThrow()
  })

  it('does not throw for a click line (no arrow token present)', () => {
    expect(() =>
      parse(`classDiagram
        class Animal
        click Animal "https://example.com" "Tooltip"`),
    ).not.toThrow()
  })

  it('does not throw for a valid inline attribute with a method-shaped default value', () => {
    expect(() =>
      parse(`classDiagram
        Animal : +String name`),
    ).not.toThrow()
  })
})
