/**
 * Class `direction` (#2116): the parser records it; the ASCII renderer draws
 * TB and BT, and keeps LR and RL top-down (documented in docs/diagrams.md).
 */
import { describe, it, expect } from 'vitest'
import { parseClassDiagram } from '@zombie-mermaid/mermaid-parser'
import { splitStatements } from '@zombie-mermaid/core'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const parse = (text: string) => parseClassDiagram(splitStatements(text))
const ascii = (src: string, useAscii = false, direction?: 'BT' | 'LR') =>
  renderMermaidASCII(src, { colorMode: 'none', useAscii, direction })

describe('parser records `direction`', () => {
  it.each([
    ['TB', 'TB'],
    ['td', 'TD'],
    ['LR', 'LR'],
    ['rl', 'RL'],
    ['BT', 'BT'],
  ])('`direction %s`', (word, want) => {
    expect(
      parse(`classDiagram\n  direction ${word}\n  A <|-- B`).direction,
    ).toBe(want)
  })
  it('is undefined without a direction line, and the last one wins', () => {
    expect(parse('classDiagram\n  A <|-- B').direction).toBeUndefined()
    expect(
      parse('classDiagram\n  direction LR\n  A <|-- B\n  direction BT')
        .direction,
    ).toBe('BT')
  })
  it('does not treat a member line as a direction', () => {
    const d = parse('classDiagram\n  class A {\n    direction LR\n  }')
    expect(d.direction).toBeUndefined()
    expect(d.classes[0]!.attributes.length + d.classes[0]!.methods.length).toBe(
      1,
    )
  })
})

const chain = 'A <|-- B\n  B <|-- C'
const dir = (d: string, body = chain) =>
  `classDiagram\n  direction ${d}\n  ${body}`

describe('ASCII: BT flips the stack with the boxes upright', () => {
  for (const useAscii of [false, true]) {
    const label = useAscii ? 'ascii' : 'unicode'
    it(`orders classes bottom to top (${label})`, () => {
      const lines = ascii(dir('BT'), useAscii).split('\n')
      const row = (n: string) =>
        lines.findIndex((l) => l.includes(`| ${n} |`) || l.includes(`│ ${n} │`))
      expect(row('C')).toBeLessThan(row('B'))
      expect(row('B')).toBeLessThan(row('A'))
      // The inheritance triangle points at the parent, which is now below.
      expect(ascii(dir('BT'), useAscii)).toContain(useAscii ? 'v' : '▽')
    })
  }

  it('keeps each compartment in reading order', () => {
    const out = ascii(
      dir(
        'BT',
        'class Animal {\n    <<abstract>>\n    +String name\n    +eat() void\n  }\n  Animal <|-- Dog',
      ),
    ).split('\n')
    const at = (s: string) => out.findIndex((l) => l.includes(s))
    expect(at('<<abstract>>')).toBeLessThan(at('Animal'))
    expect(at('Animal')).toBeLessThan(at('+ String name'))
    expect(at('+ String name')).toBeLessThan(at('+ eat(): void'))
    expect(at('Dog')).toBeLessThan(at('<<abstract>>'))
  })

  it('keeps a multi-line label reading top to bottom', () => {
    const out = ascii(dir('BT', 'A --> B : first<br>second'))
    expect(out.indexOf('first')).toBeLessThan(out.indexOf('second'))
  })

  it('puts a namespace title on the top border', () => {
    const out = ascii(
      dir('BT', 'namespace Core {\n    class A\n    class B\n  }\n  A <|-- B'),
    ).split('\n')
    const title = out.findIndex((l) => l.includes('Core'))
    const boxA = out.findIndex((l) => l.includes('│ A │'))
    const boxB = out.findIndex((l) => l.includes('│ B │'))
    expect(title).toBeLessThan(Math.min(boxA, boxB))
    expect(out[title]).toMatch(/^┌.*Core.*┐/)
  })

  it('hangs a lollipop name below its host, circle between', () => {
    const out = ascii(dir('BT', 'Shape ()-- Host')).split('\n')
    const host = out.findIndex((l) => l.includes('│ Host │'))
    const circle = out.findIndex((l) => l.includes('○'))
    const name = out.findIndex((l) => l.includes('Shape'))
    expect(host).toBeLessThan(circle)
    expect(circle).toBeLessThan(name)
  })

  it('keeps the lollipop stem straight when host and name widths differ in parity', () => {
    // "Drawable" box width is even, "Shape" odd: the stem must not jog.
    const out = ascii(dir('BT', 'Shape ()-- Drawable')).split('\n')
    const circle = out.findIndex((l) => l.includes('○'))
    const col = [...out[circle]!].indexOf('○')
    expect([...out[circle - 1]!][col]).toBe('│')
    expect([...out[circle - 2]!][col]).toBe('│')
  })

  it('puts a note one rank below its class, linked by a dotted line', () => {
    const out = ascii(
      dir('BT', 'Shape <|-- Square\n  note for Square "all sides equal"'),
    ).split('\n')
    const square = out.findIndex((l) => l.includes('│ Square │'))
    const note = out.findIndex((l) => l.includes('all sides equal'))
    expect(note).toBeGreaterThan(square)
    expect(out.slice(square + 1, note).some((l) => l.includes('┊'))).toBe(true)
  })

  it('draws the BT note link with ASCII-only characters under useAscii', () => {
    const out = ascii(
      dir('BT', 'Shape <|-- Square\n  note for Square "all sides equal"'),
      true,
    )
    expect(out).toContain(':')
    expect(out).not.toMatch(/[┊╮╯╌]/)
  })

  it('keeps the BT note link clear of the boxes when the class is wider', () => {
    const out = ascii(
      dir('BT', 'Shape <|-- Square\n  note for Square "all sides equal"'),
    ).split('\n')
    const square = out.findIndex((l) => l.includes('│ Square │'))
    expect(out[square]).toMatch(/│ Square │╌+╮/)
    expect(out.find((l) => l.includes('│ Shape │'))).toContain('│ Shape │ ')
    expect(out.join('\n')).toContain('│ all sides equal │')
  })

  it('leaves the BT note link out when a sibling box is in its path', () => {
    const out = ascii(
      dir(
        'BT',
        'Shape <|-- Square\n  Shape <|-- Circle\n  note for Square "n"',
      ),
    )
    expect(out).toContain('│ Circle │')
    expect(out).toContain('│ n │')
    expect(out).not.toMatch(/[┊╌]/)
  })

  it('leaves the BT note link out when the note lands left of its class', () => {
    const out = ascii(
      dir(
        'BT',
        'Shape <|-- Circle\n  Shape <|-- Square\n  note for Square "n"',
      ),
    )
    expect(out).toContain('│ Square │')
    expect(out).not.toMatch(/[┊╌]/)
  })

  it('starts the BT note link after a detour line beside its class', () => {
    const out = ascii(
      dir(
        'BT',
        'Shape <|-- Mid\n  Mid <|-- Top\n  Shape <|-- Top\n  note for Mid "n"',
      ),
    )
    expect(out).toMatch(/│ Mid ││╌+╮/)
  })

  it('does not draw the BT note link over a relationship line it crosses', () => {
    const out = ascii(
      dir('BT', 'Sh <|-- Square\n  Sh <|-- Right\n  note for Square "n"'),
    )
    expect(out).toContain(' ┌───┌────────────┘')
    expect(out).toMatch(/│ Square │╌+╮/)
  })

  it('keeps the BT note link when a taller box only sits between its segments', () => {
    const out = ascii(
      dir(
        'BT',
        'class Shape {\n    +area() double\n    +perimeter() double\n    +describe() string\n  }\n  Shape <|-- Sq\n  note for Sq "n"',
      ),
    )
    expect(out).toMatch(/│ Sq │╌+╮/)
    expect(out).toContain('┊')
  })

  it('RenderOptions.direction still does not apply to class diagrams', () => {
    expect(ascii(dir('TB'), false, 'BT')).toBe(ascii(dir('TB')))
  })
})

describe('ASCII: TB is unchanged and LR/RL stay top-down', () => {
  it('`direction TB` equals no direction line', () => {
    expect(ascii(dir('TB'))).toBe(ascii(`classDiagram\n  ${chain}`))
  })
  for (const d of ['LR', 'RL']) {
    it(`\`direction ${d}\` equals no direction line`, () => {
      expect(ascii(dir(d))).toBe(ascii(`classDiagram\n  ${chain}`))
    })
  }
})
