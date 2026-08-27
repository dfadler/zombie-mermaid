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
// `Grid` stores its cells behind a real (`#`-private, not just
// TypeScript-`private`) field — nothing outside this module can bypass
// `gridKey` and the collision checks by reaching into the underlying
// collection directly, not even via an `any` cast or plain-JS caller.
// ============================================================================

import type { GridCoord } from './types.ts'
import { gridKey } from './types.ts'

/**
 * Grid occupancy map — an opaque set of reserved "x,y" cells. Only tracks
 * *whether* a cell is reserved, not by whom: nothing in this renderer looks
 * up which node owns a given cell (layout code identifies a node's cells via
 * `node.gridCoord`, not via the grid), so there is no per-cell node value to
 * keep honest.
 *
 * `#cells` is a JavaScript private field, not merely a TypeScript `private`
 * annotation: the latter is erased at compile time and still reachable at
 * runtime via `(grid as any).cells` or plain bracket access, which would
 * let a caller add/delete/clear cells directly and bypass `gridKey` and the
 * collision checks in `placeBlock`. A `#`-private field has no such escape
 * hatch — it's enforced by the JS engine itself, so only the methods below
 * can ever touch the underlying `Set`.
 */
export class Grid {
  #cells = new Set<string>()

  /** Whether a single cell is already reserved. */
  has(key: string): boolean {
    return this.#cells.has(key)
  }

  /** Reserve a single cell. Internal — callers go through `placeBlock`. */
  add(key: string): void {
    this.#cells.add(key)
  }
}

/** Create a fresh, empty grid occupancy map. */
export function createGrid(): Grid {
  return new Grid()
}

/** The N x N block of cells a node reserves: border, content, border. */
export const NODE_BLOCK_SIZE = 3

/** Whether a single cell is already reserved. */
export function isOccupied(grid: Grid, coord: GridCoord): boolean {
  return grid.has(gridKey(coord))
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
 *
 * Validates every cell in the block *before* reserving any of them: an
 * earlier version interleaved the occupancy check with the `add` inside a
 * single loop, so a collision on a later cell threw after earlier cells in
 * the same block had already been reserved — leaving a partial, corrupt
 * reservation behind even though the call as a whole failed. Checking the
 * whole block first means this function either reserves all of it or none
 * of it.
 */
export function placeBlock(
  grid: Grid,
  origin: GridCoord,
  size: number = NODE_BLOCK_SIZE,
): void {
  if (!isBlockFree(grid, origin, size)) {
    throw new Error(
      `Grid block at (${origin.x},${origin.y}) is already occupied`,
    )
  }

  for (let dx = 0; dx < size; dx++) {
    for (let dy = 0; dy < size; dy++) {
      const coord: GridCoord = { x: origin.x + dx, y: origin.y + dy }
      grid.add(gridKey(coord))
    }
  }
}
