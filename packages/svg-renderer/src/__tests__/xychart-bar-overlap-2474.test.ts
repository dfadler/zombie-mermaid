import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'

/** The `d` of each bar path, grouped by series colour index. */
function bars(src: string): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const m of renderMermaidSVG(src).matchAll(
    /<path d="([^"]*)" class="xychart-bar xychart-color-(\d)"/g,
  )) {
    ;(out[m[2]!] ??= []).push(m[1]!)
  }
  return out
}

const body = (head: string) =>
  `${head}\n    x-axis [a, b]\n    y-axis "v" 0 --> 10\n    bar [1, 2]\n    bar [3, 4]`

/** Left edge (vertical) or top edge (horizontal) is the first M coordinate. */
const start = (d: string, axis: 0 | 1) =>
  Number(d.match(/^M([\d.]+),([\d.]+)/)![axis + 1])

describe('multiple bar series overlap like mermaid 12.2.0 (#2474)', () => {
  it('centres every vertical series on the same x', () => {
    const b = bars(body('xychart-beta'))
    expect(b['0']!.map((d) => start(d, 0))).toEqual(
      b['1']!.map((d) => start(d, 0)),
    )
  })

  it('stacks shorter interactive hit areas after taller ones', () => {
    const svg = renderMermaidSVG(
      body('xychart-beta').replace('[3, 4]', '[9, 8]'),
      { interactive: true },
    )
    const heights = [
      ...svg.matchAll(
        /<g class="xychart-bar-group"><rect [^>]*height="([\d.]+)"/g,
      ),
    ].map((m) => Number(m[1]))
    expect(heights).toHaveLength(4)
    expect(heights).toEqual([...heights].sort((a, b) => b - a))
  })

  it('stacks shorter horizontal interactive hit areas after longer ones', () => {
    const svg = renderMermaidSVG(
      body('xychart-beta horizontal').replace('[3, 4]', '[9, 8]'),
      { interactive: true },
    )
    const widths = [
      ...svg.matchAll(
        /<g class="xychart-bar-group"><rect [^>]*width="([\d.]+)"/g,
      ),
    ].map((m) => Number(m[1]))
    expect(widths).toHaveLength(4)
    expect(widths).toEqual([...widths].sort((a, b) => b - a))
  })

  it('centres every horizontal series on the same y', () => {
    const b = bars(body('xychart-beta horizontal'))
    expect(b['0']!.map((d) => start(d, 1))).toEqual(
      b['1']!.map((d) => start(d, 1)),
    )
  })
})
