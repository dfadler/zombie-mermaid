// ============================================================================
// ASCII renderer — grid occupancy map
//
// An opaque set of "x,y" keys tracking which logical grid cells are
// reserved. Before this module existed, `grid.ts`, `pathfinder.ts`, and
// `edge-routing.ts` each poked at a raw `Map<string, AsciiNode>` directly
// (`.has(gridKey(c))`, `.set(gridKey(c), node)`), so the "x,y" string-keying
// scheme had no single owner. Centralizing it here means the keying scheme
// only needs to be gotten right once, call sites read as grid operations
// (`isFree`, `placeBlock`) rather than raw Map/Set calls, and — because
// `Grid` is a distinct wrapper type rather than a bare alias — nothing
// outside this module can bypass `gridKey` by poking at the underlying
// collection directly.
// ============================================================================

import type { GridCoord } from './types.ts'
import { gridKey } from './types.ts'

/**
 * Grid occupancy map — an opaque set of reserved "x,y" cells. Only tracks
 * *whether* a cell is reserved, not by whom: nothing in this renderer looks
 * up which node owns a given cell (layout code identifies a node's cells via
 * `node.gridCoord`, not via the grid), so there is no per-cell node value to
 * keep honest.
 */
export interface Grid {
  readonly cells: Set<string>
}

/** Create a fresh, empty grid occupancy map. */
export function createGrid(): Grid {
  return { cells: new Set() }
}

/** The N x N block of cells a node reserves: border, content, border. */
export const NODE_BLOCK_SIZE = 3

/** Whether a single cell is already reserved. */
export function isOccupied(grid: Grid, coord: GridCoord): boolean {
  return grid.cells.has(gridKey(coord))
}

/**
 * Whether a cell is free to route/place into: unoccupied and within the
 * non-negative quadrant.
 *
 * The bounds check is not an incidental side benefit of occupancy checking —
 * it is the *only* thing that bounds A*'s search space. `pathfinder.ts`'s
 * neighbor expansion generates `{x:-1,y:0}` / `{x:0,y:-1}` from `MOVE_DIRS`
 * on every iteration; without this check A* explores the infinite negative
 * quadrant on the first edge, burning the entire path budget. Do not remove
 * it as redundant.
 *
 * Note `isFree` is not the logical negation of `isOccupied`: for a negative
 * coordinate, both return `false`. `reserveSpotInGrid` (grid.ts) uses
 * `isOccupied`/`isBlockFree`; `pathfinder.ts` and `edge-routing.ts` use
 * `isFree`. Do not simplify `!isOccupied(...)` to `isFree(...)` (or vice
 * versa) — that silently changes behavior for negative/out-of-range
 * coordinates.
 */
export function isFree(grid: Grid, coord: GridCoord): boolean {
  if (coord.x < 0 || coord.y < 0) return false
  return !isOccupied(grid, coord)
}

/**
 * Whether every cell in a `size` x `size` block starting at `origin` is
 * free of existing occupants. Use before `placeBlock` to detect a collision
 * without triggering its throw.
 */
export function isBlockFree(
  grid: Grid,
  origin: GridCoord,
  size: number = NODE_BLOCK_SIZE,
): boolean {
  for (let dx = 0; dx < size; dx++) {
    for (let dy = 0; dy < size; dy++) {
      if (isOccupied(grid, { x: origin.x + dx, y: origin.y + dy })) {
        return false
      }
    }
  }
  return true
}

/**
 * Reserve a `size` x `size` block of cells starting at `origin`. Throws if
 * any cell in the block is already occupied rather than silently
 * transferring ownership — callers that want to handle a collision (e.g. by
 * shifting to a different origin) must check `isBlockFree` first.
 */
export function placeBlock(
  grid: Grid,
  origin: GridCoord,
  size: number = NODE_BLOCK_SIZE,
): void {
  for (let dx = 0; dx < size; dx++) {
    for (let dy = 0; dy < size; dy++) {
      const coord: GridCoord = { x: origin.x + dx, y: origin.y + dy }
      const key = gridKey(coord)
      if (grid.cells.has(key)) {
        throw new Error(
          `Grid cell (${coord.x},${coord.y}) is already occupied; cannot place block at (${origin.x},${origin.y})`,
        )
      }
      grid.cells.add(key)
    }
  }
}
