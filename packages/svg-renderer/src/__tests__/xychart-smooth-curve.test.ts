import { describe, it, expect } from 'vitest'
import { smoothCurvePath } from '../xychart/renderer.ts'

/** Every y coordinate in the path (Bezier control points bound the curve). */
function pathYs(d: string): number[] {
  return [...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) =>
    Number(m[2]),
  )
}

function expectWithinRange(values: number[]) {
  const points = values.map((y, i) => ({ x: i * 50, y }))
  const ys = pathYs(smoothCurvePath(points))
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  for (const y of ys) {
    expect(y).toBeGreaterThanOrEqual(lo - 0.01)
    expect(y).toBeLessThanOrEqual(hi + 0.01)
  }
}

describe('smoothCurvePath', () => {
  it('stays within the data range on a sharp spike after a flat run', () => {
    expectWithinRange([5, 12, 45, 380, 420, 250, 35, 8])
    expectWithinRange([0, 0, 0, 100, 0, 0, 0])
  })

  it('stays within the data range on a flat run and alternating values', () => {
    expectWithinRange([10, 10, 10, 10, 10])
    expectWithinRange([0, 100, 0, 100, 0])
  })

  it('passes through every data point', () => {
    const d = smoothCurvePath([
      { x: 0, y: 10 },
      { x: 50, y: 80 },
      { x: 100, y: 20 },
    ])
    expect(d).toContain('50,80')
    expect(d.endsWith('100,20')).toBe(true)
  })
})
