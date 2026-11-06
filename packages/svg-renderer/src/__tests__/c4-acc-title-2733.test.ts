/**
 * C4 `accTitle` (#2733): Mermaid 12.3.0 draws it in the title slot (same
 * position and height as `title`) and it replaces any `title`; `accDescr`
 * stays `<desc>`-only. The ASCII half is #2696.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

const body = `  Person(u, "User")\n  System(s, "System")\n  Rel(u, s, "uses")`
const drawn = (svg: string) =>
  [...svg.matchAll(/<text class="c4-title"[^>]*>([^<]*)</g)].map((m) => m[1])

describe('C4 SVG accTitle (#2733)', () => {
  it('draws accTitle in the same slot as title', () => {
    const acc = renderMermaidSVG(
      `C4Context\n  accTitle: Accessible title\n${body}`,
    )
    const plain = renderMermaidSVG(
      `C4Context\n  title Accessible title\n${body}`,
    )
    expect(drawn(acc)).toEqual(['Accessible title'])
    expect(acc.match(/viewBox="[^"]+"/)?.[0]).toEqual(
      plain.match(/viewBox="[^"]+"/)?.[0],
    )
    expect(acc.match(/<text class="c4-title"[^>]*>/)?.[0]).toEqual(
      plain.match(/<text class="c4-title"[^>]*>/)?.[0],
    )
  })

  it('lets accTitle replace title and keeps accDescr invisible', () => {
    const svg = renderMermaidSVG(
      `C4Context\n  title Shown\n  accTitle: Accessible\n  accDescr: Hidden words\n${body}`,
    )
    expect(drawn(svg)).toEqual(['Accessible'])
    expect(svg).toMatch(/<desc id="[^"]+">Hidden words<\/desc>/)
    expect(svg).not.toMatch(/<text[^>]*>[^<]*(Shown|Hidden)/)
  })

  it('draws no title for accDescr alone', () => {
    const svg = renderMermaidSVG(`C4Context\n  accDescr: d\n${body}`)
    expect(drawn(svg)).toEqual([])
  })
})
