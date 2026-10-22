/** #2283 in SVG: label shown; classifier styles (italic abstract, underlined static) but is not printed. */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'

const svg = renderMermaidSVG(`classDiagram
  class Pretty["Pretty Label"]
  Pretty : +x int
  class A {
    +size()* int
    +make()$ A
  }`)

describe('SVG class label and classifier', () => {
  it('shows the label, not the id', () => {
    expect(svg).toContain('Pretty Label')
    expect(svg).not.toMatch(/>Pretty</)
  })
  it('does not print * or $ and styles the members', () => {
    // Collect text nodes of <text>/<tspan> only (no tag stripping, so style CSS is never read).
    const text = [...svg.matchAll(/<(?:text|tspan)\b[^>]*>([^<]*)</g)]
      .map((m) => m[1])
      .join('')
    expect(text).toContain('size()')
    expect(text).not.toMatch(/[*$]/)
    expect(svg).toMatch(/font-style="italic"/)
    expect(svg).toMatch(/text-decoration="underline"/)
  })
})
