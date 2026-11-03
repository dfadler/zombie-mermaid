/**
 * #2553: a numeric x range is a linear axis in mermaid (12.3.0 labels every
 * d3 tick, 0 10 ... 100, and places points by value), not just the data points.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const SRC = `xychart-beta
  x-axis 0 --> 100
  y-axis 0 --> 10
  bar [1, 2, 3, 4, 5]`

describe('xychart numeric x axis (#2553)', () => {
  it('ASCII labels every nice tick, not only the data points', () => {
    const out = renderMermaidASCII(SRC, { useAscii: true })
    const row = out.split('\n').find((l) => /\b100\b/.test(l))!
    expect(row.match(/\d+/g)).toEqual(
      Array.from({ length: 11 }, (_, i) => String(i * 10)),
    )
  })
})
