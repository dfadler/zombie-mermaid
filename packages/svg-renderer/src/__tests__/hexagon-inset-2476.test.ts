/**
 * #2476: mermaid@12.3.0 draws a hexagon's angled sides with a horizontal
 * inset of height / 3.5 (measured at 26.857 / 94, 40.571 / 142), not
 * height / 4.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

describe('hexagon inset (#2476)', () => {
  it.each(['LR', 'TD'])('%s: inset is height / 3.5', (dir) => {
    const svg = renderMermaidSVG(`flowchart ${dir}\n  A{{Hex}} --> B`)
    const pts = svg
      .match(/data-shape="hexagon">\s*<polygon points="([^"]+)"/)![1]!
      .split(' ')
      .map((p) => p.split(',').map(Number))
    const [tl, , , , bl, left] = pts as [
      number[],
      number[],
      number[],
      number[],
      number[],
      number[],
    ]
    const h = bl[1]! - tl[1]!
    expect(tl[0]! - left[0]!).toBeCloseTo(h / 3.5, 1)
  })
})
