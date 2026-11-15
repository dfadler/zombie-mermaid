// A wrapped message wraps at the lifeline gap its own first wrap sized
// (mermaid@12.3.0 wraps twice), so line counts match mermaid's (#3197).
// Expected counts measured with scripts/lib/real-mermaid.ts.
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'

const N = 'Pneumonoultramicroscopicsilicovolcanoconiosis'
const lines = (svg: string) => (svg.match(/<tspan/g) ?? []).length

describe('wrapped message width (#3197)', () => {
  // [width, lines mermaid 12.3.0 draws for the 45-character word]
  it.each([
    [80, 3],
    [120, 2],
    [150, 2],
    [200, 2],
    [300, 1],
  ])('splits one long word like mermaid at width %i', (width, n) => {
    const svg = renderMermaidSVG(
      `%%{init: {"sequence": {"wrap": true, "width": ${width}}}}%%\nsequenceDiagram\n A->>B: ${N}`,
    )
    // Width 300 fits the word: mermaid draws it as one plain text node.
    expect(n === 1 ? (svg.includes(`>${N}<`) ? 1 : 0) : lines(svg)).toBe(
      n === 1 ? 1 : n,
    )
  })

  it('does the same through a wrap: prefix at the default width', () => {
    const svg = renderMermaidSVG(`sequenceDiagram\n A->>B: wrap: ${N}`)
    expect(lines(svg)).toBe(2)
    expect(svg).not.toContain('wrap:')
  })

  it('leaves a message without wrap whole', () => {
    expect(
      renderMermaidSVG(
        `%%{init: {"sequence": {"width": 120}}}%%\nsequenceDiagram\n A->>B: ${N}`,
      ),
    ).toContain(`>${N}<`)
  })
})
