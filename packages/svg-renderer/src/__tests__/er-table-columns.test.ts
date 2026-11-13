/**
 * Mermaid 12.3.0 draws an ER entity as a table: type | name | keys | comment,
 * with lines between rows and columns. The keys/comment columns appear only
 * when some attribute has one.
 */
import { describe, it, expect } from 'vitest'
import { mermaidTextWidth } from '../class/mermaid-text-width.ts'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

const lines = (svg: string): number => svg.match(/<line /g)?.length ?? 0
const texts = (svg: string): string[] =>
  [...svg.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((m) => m[1]!)

describe('ER attribute table', () => {
  it('lists cells in type, name, keys, comment order', () => {
    const svg = renderMermaidSVG(
      'erDiagram\n  T {\n    string a PK, FK "c"\n    string b PK,FK\n  }',
    )
    expect(texts(svg)).toEqual([
      'string',
      'a',
      'PK,FK',
      'c',
      'string',
      'b',
      'PK,FK',
    ])
  })

  it('draws a line between rows and between columns', () => {
    const two = renderMermaidSVG('erDiagram\n  T {\n    int a\n    int b\n  }')
    // Header divider + 1 row line + 1 column line
    expect(lines(two)).toBe(3)
  })

  it('tints alternate rows and spreads spare width over the columns', () => {
    const svg = renderMermaidSVG(
      'erDiagram\n  LONGENTITYNAMEHERE {\n    int a\n    int b\n  }',
    )
    expect(svg).toContain('fill="var(--_key-badge)"')
    // One row tinted (the second). The wide header leaves spare width, shared
    // evenly: the divider sits at the type column's natural width (the text at
    // 16px Trebuchet MS plus 25 of padding) plus half of what the box has
    // beyond the two natural widths.
    expect(svg.match(/fill="var\(--_key-badge\)"/g)).toHaveLength(1)
    const box = /<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/.exec(svg)!
    const divider = /<line x1="([\d.]+)" y1="[\d.]+" x2="\1"/.exec(svg)!
    const width = Number(box[2])
    const typeW = mermaidTextWidth('int', false) + 25
    const nameW = mermaidTextWidth('a', false) + 25
    expect(width).toBeGreaterThan(typeW + nameW)
    expect(Number(divider[1]) - Number(box[1])).toBeCloseTo(
      typeW + (width - typeW - nameW) / 2,
      0,
    )
  })

  it('draws an attribute-less entity as a taller box with the name centred', () => {
    const svg = renderMermaidSVG('erDiagram\n  A {\n  }')
    expect(svg).toMatch(/height="84"/)
    expect(svg).not.toContain('<line ')
  })

  it('draws each line of a <br> comment 24 apart and grows the row by one line', () => {
    const one = renderMermaidSVG('erDiagram\n  T {\n    int a "x"\n  }')
    const two = renderMermaidSVG('erDiagram\n  T {\n    int a "x<br>y"\n  }')
    expect(texts(two)).toEqual(expect.arrayContaining(['x', 'y']))
    const ys = [
      ...two.matchAll(/<text[^>]* y="([\d.]+)"[^>]*>\s*<tspan[^>]*>(x|y)</g),
    ]
    expect(Number(ys[1]![1]) - Number(ys[0]![1])).toBe(24)
    const h = (svg: string) =>
      Number(/<rect[^>]* height="([\d.]+)"/.exec(svg)![1])
    expect(h(two) - h(one)).toBe(24)
  })
})

describe('ER attribute table edge cases', () => {
  it('leaves rows untinted under a custom entity fill', () => {
    const svg = renderMermaidSVG(
      'erDiagram\n  T {\n    int a\n    int b\n  }\n  style T fill:#1e293b',
    )
    expect(svg).not.toContain('fill="var(--_key-badge)"')
  })

  it('makes a column wider for fullwidth text', () => {
    const width = (name: string) =>
      Number(
        /<rect x="[^"]*" y="[^"]*" width="([\d.]+)"/.exec(
          renderMermaidSVG(`erDiagram\n  T {\n    int ${name}\n  }`),
        )![1],
      )
    expect(width('名前名前名前名前名前名前')).toBeGreaterThan(
      width('abcdefghijkl'),
    )
  })
})
