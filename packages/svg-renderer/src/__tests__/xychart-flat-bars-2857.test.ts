import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'

// Mermaid 12.3.0 draws multi-series bar+line charts with square bars, no
// legend and the series over each other (#2857). Overlap: xychart-bar-overlap-2474.
describe('xychart bars are square with no legend like mermaid 12.3.0 (#2857)', () => {
  const svg = renderMermaidSVG(
    'xychart-beta\n  x-axis [a, b]\n  bar [1, 2]\n  bar [3, 4]\n  line [2, 3]',
  )

  it('draws bars as square paths, with no rounded rects', () => {
    const bars = [
      ...svg.matchAll(
        /<path d="([^"]*)" class="xychart-bar xychart-color-(\d+)"/g,
      ),
    ]
    for (const color of ['0', '1']) {
      const series = bars.filter((bar) => bar[2] === color)
      expect(series).toHaveLength(2)
      for (const bar of series) {
        expect(bar[1]).toMatch(/^M[\d.]+,[\d.]+ H[\d.]+ V[\d.]+ H[\d.]+ Z$/)
      }
    }
  })

  it('draws no legend', () => {
    expect(svg).not.toMatch(/legend/i)
    expect(svg).not.toMatch(/Bar 1|Line 1/)
  })
})
