/**
 * Class syntax mermaid accepts that the parser used to reject (#2117):
 * the `classDiagram-v2` header, bidirectional `<|--|>` / `<-->`, lollipop
 * `()--` / `--()`, and backtick-quoted class names. Parity: mermaid 12.1.0
 * (repo pin) and 12.2.0 draw both ends / a circle / the unquoted name.
 */
import { describe, it, expect } from 'vitest'
import { parseClassDiagram } from '@zombie-mermaid/mermaid-parser'
import { detectDiagramType, splitStatements } from '@zombie-mermaid/core'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidSVG } from '../index.ts'

const unscoped = (svg: string) => svg.replace(/zm[0-9a-z]+-/g, '')
const parse = (text: string) => parseClassDiagram(splitStatements(text))

describe('classDiagram-v2 header', () => {
  it('is an alias of classDiagram', () => {
    expect(detectDiagramType('classDiagram-v2\nA <|-- B')).toBe('class')
    expect(renderMermaidSVG('classDiagram-v2\nA <|-- B')).toBe(
      renderMermaidSVG('classDiagram\nA <|-- B'),
    )
    expect(renderMermaidASCII('classDiagram-v2\nA <|-- B')).toBe(
      renderMermaidASCII('classDiagram\nA <|-- B'),
    )
  })
})

describe('both-ends and lollipop arrows', () => {
  it.each([
    ['<|--|>', 'inheritance', 'both'],
    ['<|..|>', 'realization', 'both'],
    ['<-->', 'association', 'both'],
    ['<..>', 'dependency', 'both'],
    ['*--*', 'composition', 'both'],
    ['o--o', 'aggregation', 'both'],
    ['()--', 'lollipop', 'from'],
    ['--()', 'lollipop', 'to'],
    ['()--()', 'lollipop', 'both'],
  ])('%s -> %s at %s', (arrow, type, markerAt) => {
    const r = parse(`classDiagram\n  A ${arrow} B : x`).relationships[0]!
    expect([r.from, r.to, r.type, r.markerAt, r.label]).toEqual([
      'A',
      'B',
      type,
      markerAt,
      'x',
    ])
  })

  it('SVG puts a marker on both ends of a bidirectional line', () => {
    const svg = unscoped(renderMermaidSVG('classDiagram\n  A <|--|> B'))
    expect(svg).toMatch(/marker-start="url\(#cls-inherit\)"/)
    expect(svg).toMatch(/marker-end="url\(#cls-inherit\)"/)
  })

  it('SVG draws a lollipop as a circle marker, only when used', () => {
    const svg = unscoped(renderMermaidSVG('classDiagram\n  A ()-- B'))
    expect(svg).toContain('<marker id="cls-lollipop"')
    expect(svg).toMatch(/marker-start="url\(#cls-lollipop\)"/)
    expect(svg).not.toMatch(/marker-end="url\(#cls-lollipop\)"/)
    expect(renderMermaidSVG('classDiagram\n  A <|-- B')).not.toContain(
      'cls-lollipop',
    )
  })

  it('ASCII draws the marker at both ends', () => {
    const uni = renderMermaidASCII('classDiagram\n  A <|--|> B')
    expect(uni).toContain('△')
    expect(uni).toContain('▽')
    const arrows = renderMermaidASCII('classDiagram\n  A <--> B')
    expect(arrows).toContain('▲')
    expect(arrows).toContain('▼')
  })

  it('ASCII from-end arrowhead points into the from box', () => {
    const out = renderMermaidASCII('classDiagram\n  A <-- B')
    expect(out).toContain('▲')
    expect(out).not.toContain('▼')
  })

  it('ASCII draws a lollipop circle in both charsets', () => {
    expect(renderMermaidASCII('classDiagram\n  A ()-- B')).toContain('○')
    const ascii = renderMermaidASCII('classDiagram\n  A --() B', {
      useAscii: true,
    })
    expect(ascii).toContain('O')
  })

  it('ASCII stacks the interface above or below its host: name, circle, stem, box', () => {
    const above = renderMermaidASCII('classDiagram\n  Comparable ()-- Version')
    const rows = above.split('\n').map((r) => r.trimEnd())
    const at = (re: RegExp): number => rows.findIndex((r) => re.test(r))
    expect(at(/Comparable/)).toBeLessThan(at(/○/))
    expect(at(/○/)).toBeLessThan(at(/│ Version │/))
    expect(above).not.toContain('┌────────────┐') // no Comparable box
    const below = renderMermaidASCII('classDiagram\n  Version --() Printable')
    const r2 = below.split('\n').map((r) => r.trimEnd())
    const i = (re: RegExp): number => r2.findIndex((r) => re.test(r))
    expect(i(/│ Version │/)).toBeLessThan(i(/○/))
    expect(i(/○/)).toBeLessThan(i(/Printable/))
    // The circle is the only glyph on its row: it sits right above the name.
    expect(r2[i(/○/)]!.trim()).toBe('○')
    // Used elsewhere too, the interface name keeps its own box.
    expect(renderMermaidASCII('classDiagram\n  A ()-- B\n  A --> C')).toContain(
      '│ A │',
    )
  })

  it('still rejects a mixed pair, which has no single marker', () => {
    expect(() => parse('classDiagram\n  A <|--* B')).toThrow(/Malformed/)
  })
})

describe('backtick class names', () => {
  it('declares, relates and adds members to a quoted name', () => {
    const d = parse(`classDiagram
      class \`Animal Class!\`
      \`Animal Class!\` <|-- Duck
      \`Animal Class!\` : +int age
      class \`Other Thing\` {
        +go()
      }`)
    expect(d.classes.map((c) => c.id)).toEqual([
      'Animal Class!',
      'Duck',
      'Other Thing',
    ])
    expect(d.relationships[0]!.from).toBe('Animal Class!')
    expect(d.classes[0]!.attributes).toHaveLength(1)
    expect(d.classes[2]!.methods).toHaveLength(1)
  })

  it('renders the unquoted name in SVG and ASCII', () => {
    const src = 'classDiagram\n  `Animal Class!` <|-- Duck'
    expect(renderMermaidSVG(src)).toContain('Animal Class!')
    expect(renderMermaidSVG(src)).not.toContain('`')
    expect(renderMermaidASCII(src)).toContain('Animal Class!')
  })
})
