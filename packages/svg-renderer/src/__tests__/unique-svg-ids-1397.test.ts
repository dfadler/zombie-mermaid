import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'

const sources = {
  flowchart: 'flowchart LR\n  A --> B\n  A --- C\n  linkStyle 0 stroke:#f00',
  class: 'classDiagram\n  A <|-- B\n  A *-- C',
  sequence: 'sequenceDiagram\n  A->>B: hi\n  B-->>A: yo',
}

const ids = (svg: string) =>
  Array.from(svg.matchAll(/\sid="([^"]+)"/g), (m) => m[1] ?? '')

describe('SVG ids are unique per render (#1397)', () => {
  for (const [kind, src] of Object.entries(sources)) {
    it(`${kind}: ids differ across different renders and refs resolve`, () => {
      const a = renderMermaidSVG(src)
      const b = renderMermaidSVG(src, { fg: '#123456' })
      const idsA = ids(a)
      expect(idsA.length).toBeGreaterThan(0)
      expect(idsA.filter((i) => ids(b).includes(i))).toEqual([])
      const refs = Array.from(a.matchAll(/url\(#([^)]+)\)/g), (m) => m[1])
      expect(refs.length).toBeGreaterThan(0)
      for (const ref of refs) expect(idsA).toContain(ref)
    })
  }

  it('is deterministic for identical input', () => {
    expect(renderMermaidSVG(sources.flowchart)).toBe(
      renderMermaidSVG(sources.flowchart),
    )
  })

  it('leaves an id-free diagram untouched', () => {
    const svg = renderMermaidSVG('pie\n  "A" : 1\n  "B" : 2')
    expect(ids(svg)).toEqual([])
    expect(svg).not.toMatch(/zm[0-9a-z]+-/)
  })
})
