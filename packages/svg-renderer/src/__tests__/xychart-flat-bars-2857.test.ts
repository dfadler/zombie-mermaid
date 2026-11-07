import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'

// Mermaid 12.3.0 draws multi-series bar+line charts with square bars, no
// legend and the series over each other (#2857). Overlap: xychart-bar-overlap-2474.
describe('xychart bars are square with no legend like mermaid 12.3.0 (#2857)', () => {
  const svg = renderMermaidSVG(
    'xychart-beta\n  x-axis [a, b]\n  bar [1, 2]\n  bar [3, 4]\n  line [2, 3]',
  )

  it('draws bars as square paths, with no rounded rects', () => {
    expect(svg).toMatch(
      /<path d="M[\d.]+,[\d.]+ H[\d.]+ V[\d.]+ H[\d.]+ Z" class="xychart-bar/,
    )
    expect(svg.match(/<rect\b/g)?.length ?? 0).toBe(0)
  })

  it('draws no legend', () => {
    expect(svg).not.toMatch(/legend/i)
    expect(svg).not.toMatch(/Bar 1|Line 1/)
  })
})
