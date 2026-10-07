/**
 * #1388: parallel edges between differently sized, centered nodes kinked by a
 * fraction of a pixel near the target and tilted the arrowhead.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { layoutGraphSync } from '@zombie-mermaid/svg-renderer'
import { straightenTinyJogs } from '../layout-engine/jog-straightening.ts'

describe('straightenTinyJogs', () => {
  it('collapses a sub-pixel vertical jog into one straight run', () => {
    const out = straightenTinyJogs([
      { x: 62.48, y: 76.9 },
      { x: 62.48, y: 112.9 },
      { x: 63.11, y: 112.9 },
      { x: 63.11, y: 124.9 },
    ])
    expect(out).toHaveLength(2)
    expect(out[0]!.x).toBeCloseTo(out[1]!.x, 6)
    expect(out[0]!.y).toBe(76.9)
    expect(out[1]!.y).toBe(124.9)
  })

  it('collapses a sub-pixel horizontal jog', () => {
    const out = straightenTinyJogs([
      { x: 0, y: 10 },
      { x: 20, y: 10 },
      { x: 20, y: 10.6 },
      { x: 40, y: 10.6 },
    ])
    expect(out).toHaveLength(2)
    expect(out[0]!.y).toBeCloseTo(out[1]!.y, 6)
  })

  it('keeps a real bend', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 0, y: 20 },
      { x: 30, y: 20 },
      { x: 30, y: 40 },
    ]
    expect(straightenTinyJogs(pts)).toEqual(pts)
  })
})

describe('parallel edges between different-width nodes (#1388)', () => {
  it('routes both edges as straight vertical lines', () => {
    const g = layoutGraphSync(
      parseMermaid('graph TD\n  Top <--> Bot\n  Top <-.- Bot'),
    )
    expect(g.edges).toHaveLength(2)
    for (const e of g.edges) {
      const xs = new Set(e.points.map((p) => p.x.toFixed(2)))
      expect(xs.size, JSON.stringify(e.points)).toBe(1)
    }
  })
})
