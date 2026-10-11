import { describe, it, expect } from 'vitest'
import { niceTickValues } from '../ticks.ts'

describe('niceTickValues (d3 ticks(min, max, 10), #1705)', () => {
  it('returns the single value for an empty or inverted range', () => {
    expect(niceTickValues(5, 5)).toEqual([5])
    expect(niceTickValues(5, 1)).toEqual([5])
  })

  it('steps by 20 over 100..300', () => {
    expect(niceTickValues(100, 300)).toHaveLength(11)
  })

  it('drops multiples outside a range that does not start or end on one (step >= 1)', () => {
    expect(niceTickValues(3, 97)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90])
  })

  it('drops multiples outside a range that does not start or end on one (step < 1)', () => {
    expect(niceTickValues(0.14, 0.96)).toEqual([
      0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
    ])
  })

  it('emits no floating-point noise for fractional steps', () => {
    expect(niceTickValues(0, 0.3)).toContain(0.3)
    expect(niceTickValues(0, 0.3)).toContain(0.1)
  })
})
