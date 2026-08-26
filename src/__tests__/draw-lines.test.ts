/**
 * Direct unit tests for drawLine's diagonal routing branches
 * (UpperLeft/UpperRight/LowerLeft/LowerRight in src/ascii/draw-lines.ts).
 *
 * These branches only fire when `from` and `to` differ on both axes.
 * Every real call site (draw-arrows.ts's drawPath, draw-bundles.ts) feeds
 * drawLine coordinates derived from an A* grid path — and the pathfinder
 * only ever moves 4-directionally (see pathfinder.ts's MOVE_DIRS) — so no
 * Mermaid diagram through the renderer can actually produce a diagonal
 * `from`/`to` pair here; the pure-vertical/horizontal branches are already
 * covered that way. Testing this diagonal routing therefore has to call
 * drawLine directly, the same way pathfinder.test.ts unit-tests getPath
 * directly with hand-built inputs rather than through a full render.
 */
import { describe, it, expect } from 'vitest'
import { drawLine } from '../ascii/draw-lines.ts'
import { mkCanvas } from '../ascii/canvas.ts'

describe('drawLine diagonal routing', () => {
  it('routes UpperLeft as a horizontal-then-vertical bend', () => {
    const canvas = mkCanvas(10, 10)
    const drawn = drawLine(canvas, { x: 8, y: 8 }, { x: 2, y: 2 }, 1, -1, false)
    expect(canvas[7]![8]).toBe('─')
    expect(canvas[2]![8]).toBe('─')
    expect(canvas[2]![7]).toBe('│')
    expect(canvas[2]![3]).toBe('│')
    expect(drawn.length).toBe(6 + 5)
  })

  it('routes UpperRight as a horizontal-then-vertical bend', () => {
    const canvas = mkCanvas(10, 10)
    const drawn = drawLine(canvas, { x: 2, y: 8 }, { x: 8, y: 2 }, 1, -1, false)
    expect(canvas[3]![8]).toBe('─')
    expect(canvas[8]![8]).toBe('─')
    expect(canvas[8]![7]).toBe('│')
    expect(canvas[8]![3]).toBe('│')
    expect(drawn.length).toBe(6 + 5)
  })

  it('routes LowerLeft as a horizontal-then-vertical bend', () => {
    const canvas = mkCanvas(10, 10)
    const drawn = drawLine(canvas, { x: 8, y: 2 }, { x: 2, y: 8 }, 1, -1, false)
    expect(canvas[7]![2]).toBe('─')
    expect(canvas[2]![2]).toBe('─')
    expect(canvas[2]![3]).toBe('│')
    expect(canvas[2]![7]).toBe('│')
    expect(drawn.length).toBe(6 + 5)
  })

  describe('LowerRight', () => {
    it('draws a straight vertical line when x delta is 1 (source-aligned)', () => {
      const canvas = mkCanvas(10, 10)
      const drawn = drawLine(
        canvas,
        { x: 5, y: 2 },
        { x: 6, y: 8 },
        1,
        -1,
        false,
      )
      for (let y = 3; y <= 7; y++) {
        expect(canvas[5]![y]).toBe('│')
      }
      expect(canvas[6]![8]).toBe(' ')
      expect(drawn.every((c) => c.x === 5)).toBe(true)
      expect(drawn.length).toBe(5)
    })

    it('routes as a horizontal-then-vertical bend when x delta is greater than 1', () => {
      const canvas = mkCanvas(10, 10)
      const drawn = drawLine(
        canvas,
        { x: 2, y: 2 },
        { x: 8, y: 8 },
        1,
        -1,
        false,
      )
      expect(canvas[3]![2]).toBe('─')
      expect(canvas[8]![2]).toBe('─')
      expect(canvas[8]![3]).toBe('│')
      expect(canvas[8]![7]).toBe('│')
      expect(drawn.length).toBe(6 + 5)
    })

    it('uses ASCII characters in ASCII mode', () => {
      const canvas = mkCanvas(10, 10)
      drawLine(canvas, { x: 2, y: 2 }, { x: 8, y: 8 }, 1, -1, true)
      expect(canvas[3]![2]).toBe('-')
      expect(canvas[8]![3]).toBe('|')
    })
  })
})
