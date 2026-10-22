/**
 * #2283: `class Id["Label"]` shows Label (relationships keep using Id), and a
 * `*` / `$` classifier after a method's `)` styles the member without leaking
 * into its text. Mermaid 12.1.0 and 12.2.0 agree on both.
 */
import { describe, it, expect } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import { parseClassDiagram } from '../index.ts'

const parse = (body: string) =>
  parseClassDiagram(splitStatements(`classDiagram\n${body}`))

describe('class Id["Label"]', () => {
  it.each([
    ['bare', 'class Pretty["Pretty Label"]'],
    ['body', 'class Pretty["Pretty Label"] {\n+x() int\n}'],
    ['generic', 'class Pretty~T~["Pretty Label"]'],
  ])('uses the label as the box title (%s)', (_n, src) => {
    const d = parse(`${src}\nPretty <|-- Child`)
    expect(d.classes.map((c) => [c.id, c.label])).toEqual([
      ['Pretty', 'Pretty Label'],
      ['Child', 'Child'],
    ])
    expect([d.relationships[0]!.from, d.relationships[0]!.to].sort()).toEqual([
      'Child',
      'Pretty',
    ])
  })
})

describe('method classifiers', () => {
  it('keeps * and $ out of the member text and records the style', () => {
    const [size, make, plain] = parse(
      'class A {\n+size()* int\n+make()$ A\n+run(x int) void\n}',
    ).classes[0]!.methods
    expect(size).toMatchObject({ name: 'size', type: 'int', isAbstract: true })
    expect(make).toMatchObject({ name: 'make', type: 'A', isStatic: true })
    expect(plain).toMatchObject({
      type: 'void',
      isStatic: false,
      isAbstract: false,
    })
  })

  it('accepts a classifier with no return type', () => {
    const m = parse('class A {\n+size()*\n}').classes[0]!.methods[0]!
    expect(m).toMatchObject({ name: 'size', isAbstract: true })
    expect(m.type).toBeUndefined()
  })
})
