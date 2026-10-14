/**
 * `holdLine` / `heldByOther` (edge-routing.ts) keep `LabelContext.held` — the
 * cell -> edges index of `chosen` — in step. Covers re-holding an edge (its old
 * cells are released) and the `except` handling of `heldByOther`.
 */
import { describe, it, expect } from 'vitest'
import { heldByOther, holdLine, type LabelContext } from '../edge-routing.ts'
import type { AsciiEdge, GridCoord } from '../types.ts'

const ctx = (): LabelContext => ({
  cover: new Map(),
  chosen: new Map(),
  held: new Map(),
})
const edge = (): AsciiEdge => ({}) as AsciiEdge
const line = (x1: number, x2: number): [GridCoord, GridCoord] => [
  { x: x1, y: 0 },
  { x: x2, y: 0 },
]

describe('holdLine / heldByOther', () => {
  it('releases the old cells when an edge is re-held', () => {
    const c = ctx()
    const a = edge()
    holdLine(c, a, line(0, 2))
    holdLine(c, a, line(5, 6))
    expect(c.chosen.get(a)).toEqual(line(5, 6))
    expect(heldByOther(c, ['0,0', '1,0', '2,0'])).toBe(false)
    expect(heldByOther(c, ['5,0'])).toBe(true)
  })

  it('ignores the excepted edge but sees others, even when sharing a cell', () => {
    const c = ctx()
    const a = edge()
    const b = edge()
    holdLine(c, a, line(0, 2))
    expect(heldByOther(c, ['1,0'], a)).toBe(false)
    holdLine(c, b, line(2, 3))
    expect(heldByOther(c, ['2,0'], a)).toBe(true)
    expect(heldByOther(c, ['9,9'], a)).toBe(false)
  })
})
