/**
 * Direct unit tests for `write()` (src/ascii/canvas.ts) — specifically its
 * clip boundary in all four directions.
 *
 * These previously didn't exist: an adversarial review of PR #180
 * instrumented the clip condition and ran the full suite (1318 passing
 * tests at the time) and found the clip branch was never exercised — 0
 * clip events fired. That gap is exactly how a real border-corruption
 * regression in `drawSubgraphLabel` (src/ascii/draw-subgraphs.ts, see
 * ascii-subgraph-label-border-clip.test.ts) got through green CI: no test
 * distinguished `write()`'s clip semantics from the per-call-site guards it
 * replaced.
 */
import { describe, it, expect } from 'vitest'
import {
  mkCanvas,
  mkRoleCanvas,
  write,
  getCanvasSize,
} from '../ascii/canvas.ts'
import type { CharRole } from '../ascii/types.ts'

describe('canvas.ts write()', () => {
  it('writes within bounds, including exactly on the inclusive max edge', () => {
    const canvas = mkCanvas(2, 2) // valid indices 0..2 in both axes
    const [maxX, maxY] = getCanvasSize(canvas)
    expect([maxX, maxY]).toEqual([2, 2])

    write(canvas, 0, 0, 'A')
    write(canvas, maxX, maxY, 'B')
    write(canvas, maxX, 0, 'C')
    write(canvas, 0, maxY, 'D')

    expect(canvas[0]![0]).toBe('A')
    expect(canvas[maxX]![maxY]).toBe('B')
    expect(canvas[maxX]![0]).toBe('C')
    expect(canvas[0]![maxY]).toBe('D')
  })

  it('is a no-op at x = -1 (just past the low edge)', () => {
    const canvas = mkCanvas(2, 2)
    // No cell to inspect at x = -1; assert the call doesn't throw and
    // leaves the rest of the canvas untouched.
    expect(() => write(canvas, -1, 1, 'X')).not.toThrow()
    for (const col of canvas) {
      expect(col.every((c) => c === ' ')).toBe(true)
    }
  })

  it('is a no-op at x = maxX + 1 (just past the high edge)', () => {
    const canvas = mkCanvas(2, 2)
    const [maxX] = getCanvasSize(canvas)
    expect(() => write(canvas, maxX + 1, 1, 'X')).not.toThrow()
    for (const col of canvas) {
      expect(col.every((c) => c === ' ')).toBe(true)
    }
  })

  it('writes at x = maxX (on the inclusive edge, not clipped)', () => {
    const canvas = mkCanvas(2, 2)
    const [maxX] = getCanvasSize(canvas)
    write(canvas, maxX, 1, 'X')
    expect(canvas[maxX]![1]).toBe('X')
  })

  it('is a no-op at y = -1 (just past the low edge)', () => {
    const canvas = mkCanvas(2, 2)
    expect(() => write(canvas, 1, -1, 'X')).not.toThrow()
    for (const col of canvas) {
      expect(col.every((c) => c === ' ')).toBe(true)
    }
  })

  it('is a no-op at y = maxY + 1 (just past the high edge)', () => {
    const canvas = mkCanvas(2, 2)
    const [, maxY] = getCanvasSize(canvas)
    expect(() => write(canvas, 1, maxY + 1, 'X')).not.toThrow()
    for (const col of canvas) {
      expect(col.every((c) => c === ' ')).toBe(true)
    }
  })

  it('writes at y = maxY (on the inclusive edge, not clipped)', () => {
    const canvas = mkCanvas(2, 2)
    const [, maxY] = getCanvasSize(canvas)
    write(canvas, 1, maxY, 'X')
    expect(canvas[1]![maxY]).toBe('X')
  })

  it('never grows the canvas on an out-of-range write in any direction', () => {
    const canvas = mkCanvas(2, 2)
    const before = getCanvasSize(canvas)
    write(canvas, -1, 1, 'X')
    write(canvas, 5, 1, 'X')
    write(canvas, 1, -1, 'X')
    write(canvas, 1, 5, 'X')
    expect(getCanvasSize(canvas)).toEqual(before)
  })

  it('out-of-range writes are a no-op on the role canvas too, when roleTracking is provided', () => {
    const canvas = mkCanvas(2, 2)
    const roleCanvas = mkRoleCanvas(2, 2)
    const role: CharRole = 'border'

    write(canvas, -1, 1, 'X', { role, roleCanvas })
    write(canvas, 5, 1, 'X', { role, roleCanvas })
    write(canvas, 1, -1, 'X', { role, roleCanvas })
    write(canvas, 1, 5, 'X', { role, roleCanvas })

    for (const col of roleCanvas) {
      expect(col.every((r) => r === null)).toBe(true)
    }
  })

  it('records the role on the role canvas for an in-range write', () => {
    const canvas = mkCanvas(2, 2)
    const roleCanvas = mkRoleCanvas(2, 2)
    const role: CharRole = 'border'

    write(canvas, 1, 1, 'X', { role, roleCanvas })

    expect(canvas[1]![1]).toBe('X')
    expect(roleCanvas[1]![1]).toBe('border')
  })

  it('does not touch the role canvas when roleTracking is omitted', () => {
    const canvas = mkCanvas(2, 2)
    const roleCanvas = mkRoleCanvas(2, 2)

    write(canvas, 1, 1, 'X')

    expect(canvas[1]![1]).toBe('X')
    for (const col of roleCanvas) {
      expect(col.every((r) => r === null)).toBe(true)
    }
  })
})
