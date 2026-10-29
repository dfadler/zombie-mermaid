/**
 * Value-axis tick labels for narrow and degenerate ranges (#1234).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

function render(text: string): string {
  return renderMermaidASCII(text, { colorMode: 'none' })
}

describe('xychart ASCII – narrow-range value-axis labels', () => {
  it('labels a 99-102 range with fractional ticks, not repeated integers', () => {
    const result = render(`xychart-beta
      x-axis [A, B, C, D]
      bar [100, 102, 99, 101]`)
    // Mermaid-matching ticks (d3 ticks(…, 10)): 0.2 steps over 99..102, thinned to every 2nd tick (#2310)
    expect(result).toContain('99.4')
    expect(result).toContain('100.2')
  })

  it('renders a single tick label for a zero-width explicit range', () => {
    const result = render(`xychart-beta
      x-axis [A]
      y-axis 5 --> 5
      bar [5]`)
    expect(result).toContain('5')
  })

  it('labels the value axis of a horizontal chart with fractional ticks', () => {
    const result = render(`xychart-beta horizontal
      x-axis [A, B]
      bar [100, 102]`)
    expect(result).toMatch(/\d\.\d/)
  })

  it('thins y-axis labels so they sit on evenly spaced rows (#2310)', () => {
    const lines = render(`xychart-beta
      x-axis [A, B, C, D, E]
      bar [280, 260, 200, 180, 40]`).split('\n')
    const labeled = lines.flatMap((l, i) => (/^\s*\d+[┤┼]/.test(l) ? [i] : []))
    const gaps = labeled.slice(1).map((r, i) => r - labeled[i]!)
    expect(labeled.length).toBeGreaterThan(3)
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(2)
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1)
  })
})
