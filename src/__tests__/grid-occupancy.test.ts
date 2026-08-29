import { describe, it, expect } from 'vitest'
import {
  createGrid,
  isOccupied,
  isFree,
  isBlockFree,
  placeBlock,
  pathCells,
  NODE_BLOCK_SIZE,
} from '../ascii/grid-occupancy.ts'

describe('grid-occupancy', () => {
  it('createGrid starts empty', () => {
    const grid = createGrid()
    expect(isOccupied(grid, { x: 0, y: 0 })).toBe(false)
    expect(isFree(grid, { x: 0, y: 0 })).toBe(true)
  })

  describe('isFree', () => {
    it('is false for negative coordinates even when unoccupied', () => {
      const grid = createGrid()
      expect(isOccupied(grid, { x: -1, y: 0 })).toBe(false)
      expect(isFree(grid, { x: -1, y: 0 })).toBe(false)
      expect(isFree(grid, { x: 0, y: -1 })).toBe(false)
    })

    it('is false for an occupied non-negative cell', () => {
      const grid = createGrid()
      placeBlock(grid, { x: 2, y: 2 }, 1)
      expect(isFree(grid, { x: 2, y: 2 })).toBe(false)
    })

    it('is true for a free non-negative cell', () => {
      const grid = createGrid()
      expect(isFree(grid, { x: 5, y: 5 })).toBe(true)
    })
  })

  describe('isBlockFree / placeBlock', () => {
    it('reports a fresh block as free, then occupied after placing', () => {
      const grid = createGrid()
      const origin = { x: 0, y: 0 }
      expect(isBlockFree(grid, origin)).toBe(true)
      placeBlock(grid, origin)
      expect(isBlockFree(grid, origin)).toBe(false)
      // Every cell in the default NODE_BLOCK_SIZE x NODE_BLOCK_SIZE block
      // is reserved, not just the origin cell.
      for (let dx = 0; dx < NODE_BLOCK_SIZE; dx++) {
        for (let dy = 0; dy < NODE_BLOCK_SIZE; dy++) {
          expect(isOccupied(grid, { x: origin.x + dx, y: origin.y + dy })).toBe(
            true,
          )
        }
      }
    })

    it('detects partial overlap with an already-placed block', () => {
      const grid = createGrid()
      placeBlock(grid, { x: 0, y: 0 }) // occupies (0,0)..(2,2)
      // Shifted by 1 in each axis: overlaps the first block at (1,1)-(2,2)
      // even though its own origin cell (1,1) is inside the first block too.
      expect(isBlockFree(grid, { x: 1, y: 1 })).toBe(false)
      // Fully disjoint block (mod-4 pitch) is free.
      expect(isBlockFree(grid, { x: 4, y: 0 })).toBe(true)
    })

    it('throws rather than silently overwriting on collision', () => {
      const grid = createGrid()
      placeBlock(grid, { x: 0, y: 0 })
      expect(() => placeBlock(grid, { x: 1, y: 1 })).toThrow(/already occupied/)
    })

    it('supports a single-cell block via size=1', () => {
      const grid = createGrid()
      placeBlock(grid, { x: 3, y: 3 }, 1)
      expect(isOccupied(grid, { x: 3, y: 3 })).toBe(true)
      expect(isOccupied(grid, { x: 4, y: 3 })).toBe(false)
      expect(isOccupied(grid, { x: 3, y: 4 })).toBe(false)
    })
  })

  describe('Grid.delete', () => {
    it('releases a cell so it reports free again', () => {
      const grid = createGrid()
      grid.add('5,5')
      expect(grid.has('5,5')).toBe(true)
      grid.delete('5,5')
      expect(grid.has('5,5')).toBe(false)
    })

    it('is a no-op for a cell that was never reserved', () => {
      const grid = createGrid()
      expect(() => grid.delete('9,9')).not.toThrow()
      expect(grid.has('9,9')).toBe(false)
    })
  })

  describe('pathCells', () => {
    it('returns an empty array for an empty path', () => {
      expect(pathCells([])).toEqual([])
    })

    it('returns the single point for a one-point path', () => {
      expect(pathCells([{ x: 4, y: 7 }])).toEqual([{ x: 4, y: 7 }])
    })

    it('walks every intermediate cell of a horizontal segment', () => {
      const cells = pathCells([
        { x: 0, y: 0 },
        { x: 3, y: 0 },
      ])
      expect(cells).toEqual([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ])
    })

    it('walks every intermediate cell of a vertical segment', () => {
      const cells = pathCells([
        { x: 2, y: 5 },
        { x: 2, y: 2 },
      ])
      expect(cells).toEqual([
        { x: 2, y: 5 },
        { x: 2, y: 4 },
        { x: 2, y: 3 },
        { x: 2, y: 2 },
      ])
    })

    it('walks a clean 45° diagonal', () => {
      const cells = pathCells([
        { x: 0, y: 0 },
        { x: 3, y: 3 },
      ])
      expect(cells).toEqual([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 3 },
      ])
    })

    /**
     * Regression for a real crash: `determinePath`'s Case-4 direct fallback
     * (`edge.path = [prefFrom, prefTo]`, used when A* finds no route at
     * all) can produce a segment whose dx/dy ratio is anything, not just
     * 0, equal, or axis-aligned. An earlier version of `pathCells` stepped
     * both axes by `Math.sign(delta)` every iteration, which only ever
     * reaches the target when `|dx| === |dy|` — for a 10-wide, 3-tall
     * segment like this one it walks (10,10), (11,11)... forever, since x
     * and y can never both equal (10,3) on the same iteration. That
     * doesn't just produce a wrong path — it hung the real render until a
     * backing `Set` threw "maximum size exceeded" (see
     * ascii-edge-cross-style-overlap.test.ts for the end-to-end repro).
     * Bresenham handles any ratio and is guaranteed to land exactly on the
     * endpoint in `max(|dx|, |dy|) + 1` steps.
     */
    it('terminates and lands exactly on the endpoint for a non-45° diagonal', () => {
      const cells = pathCells([
        { x: 0, y: 0 },
        { x: 10, y: 3 },
      ])
      expect(cells[cells.length - 1]).toEqual({ x: 10, y: 3 })
      expect(cells.length).toBe(11) // max(|10|, |3|) + 1
      // Every step must move by at most one cell on each axis (no skips,
      // no doubling back) — Bresenham can step both axes in the same
      // iteration to stay close to the true line, so Chebyshev distance
      // between consecutive cells is always exactly 1, though Manhattan
      // distance can be 1 or 2.
      for (let i = 1; i < cells.length; i++) {
        const a = cells[i - 1]!
        const b = cells[i]!
        expect(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))).toBe(1)
      }
    })

    it('walks a multi-segment path corner-to-corner without duplicating the shared corner', () => {
      const cells = pathCells([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
      ])
      expect(cells).toEqual([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
      ])
    })
  })
})
