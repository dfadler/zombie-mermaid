/**
 * ER `style`, `classDef`, `class` and the `A:::name` shorthand (#2107).
 * Mermaid 12.1.0 and 12.2.0 paint the entity (fill, stroke, stroke-width,
 * color) for all four spellings; before this the ER parser ignored them.
 * Colour values go through the same cascade and `dropInvalidColors` as the
 * other diagram types (see invalid-style-colors-1918.test.ts for bad values).
 * ASCII output ignores colour declarations in every diagram type.
 */
import { describe, it, expect } from 'vitest'
import { parseErDiagram } from '@zombie-mermaid/mermaid-parser'
import { splitStatements } from '@zombie-mermaid/core'
import { renderMermaidASCII, renderMermaidSVG } from '../index.ts'

const BASE = `erDiagram
  A {
    string id PK
    string name
  }
  A ||--o{ B : has
`
const parse = (src: string) => parseErDiagram(splitStatements(src))
const entityGroup = (svg: string, id: string) => {
  const start = svg.indexOf(`<g class="entity`)
  const re = new RegExp(`<g class="entity[^"]*" data-id="${id}"[\\s\\S]*?</g>`)
  return start < 0 ? '' : (svg.match(re)?.[0] ?? '')
}

describe('ER style statements are parsed', () => {
  it('stores style, classDef and class assignments', () => {
    const d = parse(
      BASE +
        '  style A fill:#f00,stroke:#0f0\n  classDef hot fill:#00f\n  class A,B hot',
    )
    expect(d.nodeStyles.get('A')).toEqual({ fill: '#f00', stroke: '#0f0' })
    expect(d.classDefs.get('hot')).toEqual({ fill: '#00f' })
    expect(d.classAssignments.get('A')).toBe('hot')
    expect(d.classAssignments.get('B')).toBe('hot')
  })

  it('reads the ::: shorthand on a bare entity, an entity block and both relationship ends', () => {
    const d = parse(
      `erDiagram
  C:::one
  D:::two {
    int x
  }
  A:::three ||--o{ B:::four : has`,
    )
    expect(Object.fromEntries(d.classAssignments)).toEqual({
      C: 'one',
      D: 'two',
      A: 'three',
      B: 'four',
    })
    expect(d.entities.map((e) => e.id).sort()).toEqual(['A', 'B', 'C', 'D'])
    expect(d.relationships[0]).toMatchObject({ entity1: 'A', entity2: 'B' })
  })

  it('accepts a classDef after the class that names it', () => {
    const svg = renderMermaidSVG(
      BASE + '  class A hot\n  classDef hot fill:#ff0000',
    )
    expect(entityGroup(svg, 'A')).toContain('fill="#ff0000"')
  })
})

describe('ER style statements paint the entity (SVG)', () => {
  it('style: fill, stroke, stroke-width and color', () => {
    const g = entityGroup(
      renderMermaidSVG(
        BASE +
          '  style A fill:#ff0000,stroke:#00ff00,stroke-width:4px,color:#0000ff',
      ),
      'A',
    )
    expect(g).toMatch(/<rect[^>]*fill="#ff0000"[^>]*stroke="#00ff00"/)
    expect(g).toContain('stroke-width="4px"')
    expect(g).toContain('fill="#0000ff"')
    expect(g).not.toContain('var(--_node-fill)')
  })

  it('classDef + class paints A and leaves B alone', () => {
    const svg = renderMermaidSVG(
      BASE + '  classDef hot fill:#ff0000\n  class A hot',
    )
    expect(entityGroup(svg, 'A')).toContain('fill="#ff0000"')
    expect(entityGroup(svg, 'B')).not.toContain('#ff0000')
  })

  it.each([
    ['bare entity', 'A:::hot'],
    ['relationship end', 'A:::hot ||--o{ B : has'],
  ])('::: shorthand on a %s', (_n, line) => {
    const src = `erDiagram\n  A {\n    string id\n  }\n  ${line}\n  classDef hot fill:#ff0000`
    const svg = renderMermaidSVG(src)
    expect(entityGroup(svg, 'A')).toContain('fill="#ff0000"')
  })

  it('classDef default styles every entity', () => {
    const svg = renderMermaidSVG(BASE + '  classDef default fill:#ffff00')
    expect(entityGroup(svg, 'A')).toContain('fill="#ffff00"')
    expect(entityGroup(svg, 'B')).toContain('fill="#ffff00"')
  })

  it('cascade: style beats the class, the class beats default', () => {
    const svg = renderMermaidSVG(
      BASE +
        '  classDef default fill:#111111,stroke:#222222\n  classDef hot fill:#ff0000\n  class A hot\n  style A fill:#00ff00',
    )
    const g = entityGroup(svg, 'A')
    expect(g).toContain('fill="#00ff00"')
    expect(g).not.toContain('#ff0000')
    expect(g).toContain('stroke="#222222"')
  })

  it('emits the style class on the entity group', () => {
    const svg = renderMermaidSVG(
      BASE + '  classDef hot fill:#ff0000\n  class A hot',
    )
    expect(svg).toContain('<g class="entity hot" data-id="A"')
  })

  it('styles an aliased entity by its id', () => {
    const svg = renderMermaidSVG(
      'erDiagram\n  p[Person] {\n    string n\n  }\n  style p fill:#ff0000',
    )
    expect(entityGroup(svg, 'p')).toContain('fill="#ff0000"')
  })

  it('ignores a style for an unknown entity and a class with no classDef', () => {
    const plain = renderMermaidSVG(BASE)
    const norm = (s: string) => s.replace(/\bzm[a-z0-9]+-/g, 'zm-')
    expect(norm(renderMermaidSVG(BASE + '  style Z fill:#ff0000'))).toBe(
      norm(plain),
    )
    expect(
      norm(renderMermaidSVG(BASE + '  class A nope')).replace(
        'class="entity nope"',
        'class="entity"',
      ),
    ).toBe(norm(plain))
  })

  it('an unstyled diagram is unchanged by the style code', () => {
    expect(renderMermaidSVG(BASE)).toContain('fill="var(--_node-fill)"')
  })
})

describe('ER colour declarations in ASCII', () => {
  it('are ignored, as in every other diagram type', () => {
    const styled =
      BASE + '  classDef hot fill:#ff0000\n  class A hot\n  style B fill:#00f'
    for (const colorMode of ['none', 'truecolor'] as const) {
      expect(renderMermaidASCII(styled, { colorMode })).toBe(
        renderMermaidASCII(BASE, { colorMode }),
      )
    }
  })
})
