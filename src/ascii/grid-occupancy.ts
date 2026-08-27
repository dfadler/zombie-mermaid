// ============================================================================
// ASCII renderer — grid occupancy map
//
// A thin abstraction around the `Map<string, AsciiNode>` that tracks which
// logical grid cells are reserved by which node. Before this module existed,
// `grid.ts`, `pathfinder.ts`, and `edge-routing.ts` each poked at that Map
// directly (`.has(gridKey(c))`, `.set(gridKey(c), node)`), so the "x,y"
// string-keying scheme had no single owner. Centralizing it here means the
// keying scheme only needs to be gotten right once, and call sites read as
// grid operations (`isFree`, `place`) rather than raw Map calls.
// ============================================================================

import type { GridCoord, AsciiNode } from './types.ts'
import { gridKey } from './types.ts'

/** Grid occupancy map — maps "x,y" keys to the node occupying that cell. */
export type Grid = Map<string, AsciiNode>

/** Create a fresh, empty grid occupancy map. */
export function createGrid(): Grid {
  return new Map()
}

/** Whether a cell is already reserved by some node. */
export function isOccupied(grid: Grid, coord: GridCoord): boolean {
  return grid.has(gridKey(coord))
}

/**
 * Whether a cell is free to route/place into: unoccupied and within the
 * non-negative quadrant. Pathfinding never explores negative coordinates, so
 * this doubles as the pathfinder's "in bounds" check.
 */
export function isFree(grid: Grid, coord: GridCoord): boolean {
  if (coord.x < 0 || coord.y < 0) return false
  return !isOccupied(grid, coord)
}

/** Reserve a single cell for a node. */
export function place(grid: Grid, node: AsciiNode, coord: GridCoord): void {
  grid.set(gridKey(coord), node)
}
