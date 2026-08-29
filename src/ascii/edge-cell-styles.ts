// ============================================================================
// ASCII renderer — cross-style edge overlap detection
//
// `graph.grid` (grid-occupancy.ts) only tracks *node* occupancy, so two
// unrelated edges (different source and target — no reason for
// `analyzeEdgeBundles` to group them, and A* itself only avoids node cells)
// can independently route through the same empty cell. When both edges have
// the *same* line style that's harmless — it just looks like one clean
// shared line, which `analyzeEdgeBundles`'s "LR routing handles merging
// naturally at corners" comment and its own trunk-sharing tests rely on
// intentionally. It's only a real defect when the styles *differ*: a solid
// cell and a dotted cell can't both be drawn at the same grid position, so
// one silently overwrites the other and the reader can't tell two distinct
// connections are there at all.
//
// This module tracks, per *open, non-node* cell, which single style has
// claimed it (first claim wins) so grid.ts can detect a genuine cross-style
// collision after routing an edge and reroute just that edge around it —
// see `rerouteAroundStyleConflicts` in grid.ts.
//
// Node-occupied cells are deliberately excluded from tracking: an edge's
// path always includes its own source/target node's border cell (that's
// how it connects to the box at all), so two edges sharing a node — one
// incoming, one outgoing, as in a retry loop's `B -->|No| D; D -.-> A` —
// legitimately share that exact port cell. The character actually drawn
// there comes from the node's own box-drawing code, not either edge's line
// style, so it was never a real conflict. Blocking it wouldn't even help:
// an edge always returns to its own node's fixed attachment point
// regardless of grid occupancy, so re-routing around a node-owned "conflict"
// just finds the identical cell again on every retry.
// ============================================================================

import type { AsciiEdgeStyle, GridCoord } from './types.ts'
import { gridKey } from './types.ts'
import { isOccupied, pathCells, type Grid } from './grid-occupancy.ts'

/** Cells already claimed by a drawn edge, keyed by "x,y", storing which
 * single line style is drawn there. */
export type EdgeCellStyles = Map<string, AsciiEdgeStyle>

export function createEdgeCellStyles(): EdgeCellStyles {
  return new Map()
}

/**
 * The first open (non-node-occupied) cell in `path` already claimed by a
 * *different* style than `style`. Same-style overlap is not reported — see
 * module doc.
 */
export function findStyleConflict(
  grid: Grid,
  cellStyles: EdgeCellStyles,
  path: readonly GridCoord[],
  style: AsciiEdgeStyle,
): GridCoord | null {
  for (const cell of pathCells(path)) {
    if (isOccupied(grid, cell)) continue
    const existing = cellStyles.get(gridKey(cell))
    if (existing !== undefined && existing !== style) return cell
  }
  return null
}

/**
 * Record every open (non-node-occupied) cell in `path` as claimed by
 * `style`. First claim per cell wins — a later same-style edge through the
 * same cell is a harmless no-op, and a later different-style edge is
 * caught by `findStyleConflict` before this ever runs for it.
 */
export function claimPathCells(
  grid: Grid,
  cellStyles: EdgeCellStyles,
  path: readonly GridCoord[],
  style: AsciiEdgeStyle,
): void {
  for (const cell of pathCells(path)) {
    if (isOccupied(grid, cell)) continue
    const key = gridKey(cell)
    if (!cellStyles.has(key)) cellStyles.set(key, style)
  }
}
