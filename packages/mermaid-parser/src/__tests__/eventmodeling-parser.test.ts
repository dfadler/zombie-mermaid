import { describe, it, expect } from 'vitest'
import { MermaidParseError } from '@zombie-mermaid/core'
import { parseEventModeling } from '../eventmodeling/parser.ts'

describe('parseEventModeling', () => {
  it('reads frames, entity types and namespaces', () => {
    const em = parseEventModeling(`eventmodeling
tf 01 ui CartUI
timeframe 02 command AddItem
rf 03 evt Inventory.Changed
resetframe 4 pcr Pricing
tf 005 rmo A.B.C
tf 006 readmodel R
tf 007 processor P
tf 008 event E
tf 009 cmd C
`)
    expect(
      em.frames.map((f) => [
        f.id,
        f.reset,
        f.entityType,
        f.identifier,
        f.namespace,
        f.name,
      ]),
    ).toEqual([
      ['01', false, 'ui', 'CartUI', undefined, 'CartUI'],
      ['02', false, 'command', 'AddItem', undefined, 'AddItem'],
      ['03', true, 'event', 'Inventory.Changed', 'Inventory', 'Changed'],
      ['4', true, 'processor', 'Pricing', undefined, 'Pricing'],
      // Only an identifier with exactly one dot has a namespace.
      ['005', false, 'readmodel', 'A.B.C', undefined, 'A.B.C'],
      ['006', false, 'readmodel', 'R', undefined, 'R'],
      ['007', false, 'processor', 'P', undefined, 'P'],
      ['008', false, 'event', 'E', undefined, 'E'],
      ['009', false, 'command', 'C', undefined, 'C'],
    ])
  })

  it('reads source frames, dropping unknown ones and repeats', () => {
    const em = parseEventModeling(`eventmodeling
tf 01 evt A
tf 02 evt B
tf 03 rmo C ->> 01 ->> 02 ->> 01 ->> 09
tf 04 ui D ->> 03
`)
    expect(em.frames.map((f) => f.sources)).toEqual([
      [],
      [],
      ['01', '02'],
      ['03'],
    ])
  })

  it('reads inline data in braces and quotes, with an optional type', () => {
    const em = parseEventModeling(
      `eventmodeling
tf 01 cmd A { description: string }
tf 02 cmd B "quoted"
tf 03 cmd C 'single'
tf 04 rmo D \`json\`{ "name": "foo" }
tf 05 ui E
`,
    )
    expect(em.frames.map((f) => f.dataInline)).toEqual([
      '{ description: string }',
      '"quoted"',
      "'single'",
      '{ "name": "foo" }',
      undefined,
    ])
  })

  it('reads data blocks and references, also across lines and with a type', () => {
    const em = parseEventModeling(`eventmodeling
tf 01 cmd A
  [[One]]
tf 02 evt B [[Missing]]
data One \`md\`{
  a: 1
  b: 2
}
data Two {
}
`)
    expect(em.frames.map((f) => f.dataRef)).toEqual(['One', 'Missing'])
    expect(em.dataBlocks).toEqual([
      { name: 'One', value: '{\n  a: 1\n  b: 2\n}\n' },
      { name: 'Two', value: '{\n}\n' },
    ])
  })

  it('skips comments, directives, front matter and CRLF line ends', () => {
    const em = parseEventModeling(
      '---\r\ntitle: x\r\n---\r\n%%{init: {"theme": "dark"}}%%\r\neventmodeling\r\n%% a comment\r\n// another\r\n/* block\r\ncomment */\r\ntf 01 ui A\r\n',
    )
    expect(em.frames.map((f) => f.id)).toEqual(['01'])
  })

  it('accepts an empty diagram, entity, note and gwt statements', () => {
    expect(parseEventModeling('eventmodeling').frames).toEqual([])
    const em = parseEventModeling(`eventmodeling
entity Foo
tf 01 ui A
tf 02 cmd B
tf 03 evt C
note 02 {
  hello
}
note 03 \`text\`{
}
gwt 02 given evt C ui A when cmd B then evt C evt C
gwt 03 given evt C then evt C
`)
    expect(em.frames).toHaveLength(3)
    expect(em.dataBlocks).toEqual([])
  })

  const fail = (src: string): string => {
    try {
      parseEventModeling(src)
    } catch (e) {
      expect(e).toBeInstanceOf(MermaidParseError)
      expect((e as MermaidParseError).diagramType).toBe('eventmodeling')
      return (e as Error).message
    }
    throw new Error('expected a parse error')
  }

  it('rejects what Mermaid 12.3.0 rejects', () => {
    expect(fail('flowchart TD')).toMatch(
      /Line 1: Expected the "eventmodeling" header/,
    )
    expect(fail('eventmodeling\ntf 01 ui A\ntf 01 cmd B')).toBe(
      'Line 3: Duplicate event modeling frame ID "01"',
    )
    expect(fail('eventmodeling\ntf 0001 ui A')).toMatch(
      /Line 2: Expected a frame number/,
    )
    expect(fail('eventmodeling\nTF 01 ui A')).toMatch(
      /Line 2: Unexpected "TF 01 ui A"/,
    )
    expect(fail('eventmodeling\ntitle My model')).toMatch(/Unexpected "title/)
    expect(fail('eventmodeling\naccTitle: T')).toMatch(/Unexpected "accTitle/)
    expect(fail('eventmodeling\ntf 01 widget A')).toMatch(/Expected ui, pcr/)
    expect(fail('eventmodeling\ntf 01 ui')).toMatch(/Expected an identifier/)
    expect(fail('eventmodeling\ntf 01 ui A ->> x')).toMatch(
      /Expected a frame number/,
    )
    expect(fail('eventmodeling\ntf 01 ui A [[One')).toMatch(/Expected "\]\]"/)
    expect(fail('eventmodeling\ntf 01 ui A `bogus`{ x }')).toMatch(
      /Unknown data type `bogus`/,
    )
    expect(fail('eventmodeling\ndata One { x }')).toMatch(
      /Expected a data block/,
    )
    expect(fail('eventmodeling\ndata\n')).toMatch(/Expected a data block name/)
    expect(fail('eventmodeling\nentity')).toMatch(
      /Expected an entity identifier/,
    )
    expect(fail('eventmodeling\ntf 01 ui A {\n}')).toMatch(/Unexpected/)
    expect(fail('eventmodeling\ngwt 01 when evt A')).toMatch(/Expected "given"/)
  })
})
