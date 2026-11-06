import { describe, it, expect } from 'vitest'
import {
  renderMermaidSVG,
  renderMermaidASCII,
  validateMermaid,
} from '../index.ts'
import { stripFrontMatter, splitStatements } from '@zombie-mermaid/core'

const fm = '---\nother: T\n---\n'
const bodies: Record<string, string> = {
  flowchart: 'flowchart TD\n  A-->B',
  sequence: 'sequenceDiagram\n  A->>B: hi',
  class: 'classDiagram\n  A <|-- B',
  er: 'erDiagram\n  A ||--o{ B : has',
  pie: 'pie\n  "a": 1\n  "b": 2',
  state: 'stateDiagram-v2\n  [*] --> A',
  c4: 'C4Context\n  Person(a, "A")',
  architecture: 'architecture-beta\n  service a(server)[A]',
}

describe('front matter (#2585)', () => {
  for (const [name, body] of Object.entries(bodies)) {
    it(`${name}: same output with and without front matter`, () => {
      expect(renderMermaidSVG(fm + body)).toBe(renderMermaidSVG(body))
      expect(renderMermaidASCII(fm + body)).toBe(renderMermaidASCII(body))
    })
  }

  describe('title: (mermaid 12.3.0 draws it on every type but C4/architecture)', () => {
    const titled = '---\ntitle: FM Title\n---\n'
    // Drawn above the diagram by a post-pass: viewBox grows up by 54px.
    for (const name of ['flowchart', 'class', 'er', 'state']) {
      it(`${name}: SVG band + ASCII row`, () => {
        const plain = renderMermaidSVG(bodies[name]!)
        const svg = renderMermaidSVG(titled + bodies[name])
        const [, w, h] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(plain)!
        expect(svg).toContain(`viewBox="0 -54 ${w} ${Number(h) + 54}"`)
        expect(svg).toContain('>FM Title</text>')
        expect(svg).toContain('y="-25"')
        const ascii = renderMermaidASCII(titled + bodies[name], {
          colorMode: 'none',
        })
        expect(ascii.split('\n')[0]!.trim()).toBe('FM Title')
        expect(
          ascii.endsWith(
            renderMermaidASCII(bodies[name]!, { colorMode: 'none' }),
          ),
        ).toBe(true)
      })
    }
    for (const name of ['pie', 'sequence']) {
      it(`${name}: uses the diagram's own title slot`, () => {
        const own =
          name === 'pie'
            ? 'pie title FM Title\n  "a": 1\n  "b": 2'
            : bodies.sequence + '\n  title FM Title'
        expect(renderMermaidSVG(titled + bodies[name])).toBe(
          renderMermaidSVG(own),
        )
        expect(renderMermaidASCII(titled + bodies[name])).toBe(
          renderMermaidASCII(own),
        )
      })
    }
    it('xychart and quadrant take it as their chart title', () => {
      const xy = 'xychart-beta\n  x-axis [a, b]\n  bar [1, 2]'
      expect(renderMermaidSVG(titled + xy)).toBe(
        renderMermaidSVG(
          'xychart-beta\n  title "FM Title"\n  x-axis [a, b]\n  bar [1, 2]',
        ),
      )
      const q =
        'quadrantChart\n  x-axis L --> R\n  y-axis B --> T\n  A: [0.3, 0.6]'
      expect(renderMermaidSVG(titled + q)).toBe(
        renderMermaidSVG(q + '\n  title FM Title'),
      )
      expect(renderMermaidASCII(titled + q)).toContain('FM Title')
    })
    it("the diagram's own title wins; empty title and C4/architecture draw nothing", () => {
      expect(renderMermaidSVG(titled + 'pie title Body\n  "a": 1')).toBe(
        renderMermaidSVG('pie title Body\n  "a": 1'),
      )
      expect(
        renderMermaidSVG(titled + 'sequenceDiagram\n  title Body\n  A->>B: hi'),
      ).toBe(renderMermaidSVG('sequenceDiagram\n  title Body\n  A->>B: hi'))
      expect(renderMermaidSVG('---\ntitle:\n---\n' + bodies.flowchart)).toBe(
        renderMermaidSVG(bodies.flowchart!),
      )
      for (const n of ['c4', 'architecture']) {
        expect(renderMermaidSVG(titled + bodies[n])).toBe(
          renderMermaidSVG(bodies[n]!),
        )
      }
    })
    for (const name of Object.keys(bodies)) {
      it(`${name}: SVG and ASCII snapshots`, () => {
        expect(renderMermaidSVG(titled + bodies[name])).toMatchSnapshot()
        expect(
          renderMermaidASCII(titled + bodies[name], { colorMode: 'none' }),
        ).toMatchSnapshot()
      })
    }
    it('a title wider than the diagram widens the canvas', () => {
      const svg = renderMermaidSVG(
        '---\ntitle: A very long front matter title that outgrows a tiny diagram\n---\nflowchart TD\n  A-->B',
      )
      expect(svg).toMatch(/viewBox="-\d+ -54 /)
    })
  })

  it('config: maps to the init directive', () => {
    const body = 'flowchart TD\n  A-->B\n  A-->C'
    const viaFm = renderMermaidSVG(
      '---\nconfig:\n  flowchart:\n    curve: stepAfter\n---\n' + body,
    )
    const viaInit = renderMermaidSVG(
      `%%{init: {"flowchart": {"curve": "stepAfter"}}}%%\n` + body,
    )
    expect(viaFm).toBe(viaInit)
    expect(viaFm).not.toBe(renderMermaidSVG(body))
  })

  it('keeps line numbers for errors after the block', () => {
    expect(() =>
      validateMermaid(fm + 'erDiagram\n  A ||--o{ B\n  ???'),
    ).toThrow(/Line 5: ER relationship/)
  })

  it('unterminated block errors at the opening fence', () => {
    expect(() =>
      renderMermaidSVG('---\ntitle: T\nflowchart TD\nA-->B'),
    ).toThrow(/Line 1: Unterminated front matter/)
  })

  it('matches mermaid 12.3.0: block must start at character 0 and be non-empty', () => {
    for (const src of [
      '\n---\nt: 1\n---\nflowchart TD',
      '---\n---\nflowchart TD',
    ]) {
      expect(stripFrontMatter(src)).toBe(src)
      expect(() => renderMermaidSVG(src)).toThrow(/Invalid mermaid header/)
    }
  })

  it('a lone fence is unterminated', () => {
    expect(() => stripFrontMatter('---')).toThrow(/Line 1: Unterminated/)
  })

  it('only a leading block counts; yaml oddities and CRLF are tolerated', () => {
    expect(stripFrontMatter('')).toBe('')
    expect(stripFrontMatter('flowchart TD\n---\nx\n---')).toBe(
      'flowchart TD\n---\nx\n---',
    )
    const crlf = '---\r\ntitle: T\r\n---\r\nflowchart TD\r\nA-->B'
    expect(splitStatements(crlf)[0]!.text).toBe('flowchart TD')
    const odd =
      '---\n# c\n\ntitle: T\nconfig:\n  bad line\n  theme: "dark"\n  a:\n    b: 1 # n\n    c: true\n  d: x\nother:\n  k: v\n---\nflowchart TD'
    expect(stripFrontMatter(odd).split('\n')[0]).toBe(
      '%%{init: {"theme":"dark","a":{"b":1,"c":true},"d":"x"}}%%',
    )
  })
})
