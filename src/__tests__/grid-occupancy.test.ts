import { describe, it, expect } from 'vitest'
import {
  createGrid,
  isOccupied,
  isFree,
  isBlockFree,
  placeBlock,
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
})
