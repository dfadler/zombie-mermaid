import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'

/** The `d` of the crisp line path (not the shadow). */
function linePath(src: string): string {
  const m = renderMermaidSVG(src).match(
    /<path d="([^"]*)" class="xychart-line xychart-color-0"/,
  )
  return m![1]!
}

const body = (head: string, vals: string) =>
  `${head}\n    x-axis [a, b, c, d, e]\n    y-axis "v" 0 --> 100\n    line [${vals}]`

describe('horizontal XY line paths (#2334)', () => {
  it('draws a non-monotone series as straight segments in category order', () => {
    expect(
      linePath(body('xychart-beta horizontal', '10, 90, 20, 80, 30')),
    ).toBe('M148.1,97 L611.9,178.5 L206.1,260 L553.9,341.5 L264.1,423')
  })

  it('keeps category (y) strictly increasing along the path', () => {
    const ys = [
      ...linePath(
        body('xychart-beta horizontal', '10, 90, 20, 80, 30'),
      ).matchAll(/,([\d.]+)/g),
    ].map((m) => Number(m[1]))
    expect(ys.length).toBe(5)
    expect(ys).toEqual([...ys].sort((a, b) => a - b))
  })

  it('draws a monotone series as straight segments too', () => {
    expect(
      linePath(body('xychart-beta horizontal', '10, 30, 50, 70, 90')),
    ).toBe('M148.1,97 L264.1,178.5 L380,260 L495.9,341.5 L611.9,423')
  })

  it('draws a single point as a lone M and two points as M L', () => {
    const one = renderMermaidSVG(
      'xychart-beta horizontal\n    x-axis [a]\n    y-axis "v" 0 --> 100\n    line [40]',
    )
    expect(one).toMatch(/<path d="M[\d.]+,[\d.]+" class="xychart-line /)
    const two = renderMermaidSVG(
      'xychart-beta horizontal\n    x-axis [a, b]\n    y-axis "v" 0 --> 100\n    line [40, 60]',
    )
    expect(two).toMatch(
      /<path d="M[\d.]+,[\d.]+ L[\d.]+,[\d.]+" class="xychart-line /,
    )
  })

  it('draws vertical charts as straight segments too, as mermaid does (no curve option exists)', () => {
    expect(linePath(body('xychart-beta', '10, 90, 20, 80, 30'))).toBe(
      'M132.3,321.6 L280.1,62.4 L428,289.2 L575.9,94.8 L723.7,256.8',
    )
  })
})
