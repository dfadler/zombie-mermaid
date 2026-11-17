/**
 * #2962: mermaid@12.3.0 sizes a state box from its label wrapped at 120px
 * (24px a line, 8px a side and 16px top and bottom), measured at 16px.
 */
// Provenance (#2679): expected sizes are measured from mermaid@12.3.0 (headless, scripts/lib/real-mermaid.ts), not this renderer's own output.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setTrebuchetMetrics } from '@zombie-mermaid/core'
import { estimateNodeSize } from '../../packages/svg-renderer/src/layout-engine/to-elk.ts'

const size = (label: string, shape = 'rounded') =>
  estimateNodeSize('Y', label, shape, 13, undefined, 'TD', true)

describe('state node size (#2962)', () => {
  // The default font is mermaid's Trebuchet stack at render time; set it here.
  beforeAll(() => setTrebuchetMetrics(true))
  afterAll(() => setTrebuchetMetrics(false))

  it('keeps the 136 x 40 minimum for a short label', () => {
    expect(size('A')).toEqual({ width: 136, height: 40 })
    expect(size('A', 'rectangle')).toEqual({ width: 136, height: 40 })
  })

  it('widens to the label plus 16px when it fits on one line', () => {
    expect(size('x'.repeat(20)).width).toBeCloseTo(176.31, 1)
    expect(size('x'.repeat(30)).width).toBeCloseTo(256.47, 1)
  })

  it('wraps a spaced label at 120px and grows 24px a line', () => {
    const one = size('Wait Idle Ready Running Active Failed Paused Done')
    expect(one.width).toBe(136)
    expect(one.height % 24).toBe(16)
    expect(one.height).toBeGreaterThan(40)
  })
})
