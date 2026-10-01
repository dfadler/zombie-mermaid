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
    expect(result).toContain('99.5')
    expect(result).toContain('100.5')
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
})
