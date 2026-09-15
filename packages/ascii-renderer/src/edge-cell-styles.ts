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

import type { AsciiEdge, AsciiEdgeStyle, GridCoord } from './types.ts'
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

// ============================================================================
// Chain-edge overlap detection (independent of style)
// ============================================================================
//
// The cross-*style* conflict above only fires when two overlapping edges
// draw different characters — a same-style overlap silently draws the same
// glyph twice, which this module's own doc calls harmless, and it usually
// is: `analyzeEdgeBundles`'s own fan-in/fan-out trunk sharing is same-style
// by construction, and a "complete bipartite" crossing like `A & B --> C &
// D` (see ascii.test.ts's `ampersand_lhs_and_rhs` golden file) *deliberately*
// routes two edges that share neither endpoint (`A --> D` and `B --> C`)
// through the same shared crossbar — that is the intended, faithful
// rendering of that shape, not a defect.
//
// It stops being harmless in one specific shape a plain "shares an
// endpoint" check can't distinguish from that crossing pattern: a *chain*
// through a shared intermediate node, `A --> B` then `B --> C`, each routed
// independently. When their corners happen to coincide, `A`'s incoming leg
// and `C`'s outgoing leg trace the exact same column/row beyond the shared,
// node-owned port cell and read as one continuous `A --> C` connector
// (#1067, "System Architecture": `Mobile App --> API Gateway` and
// `API Gateway --> User Service` sharing one on-screen row with no visual
// break, even though there is no `Mobile App --> User Service` edge in the
// source). Unlike the crossing pattern above, a chain's two edges have no
// reason to share open-space cells at all beyond that one port — so this
// check is scoped *only* to chain pairs (`isChainPair` below), not to every
// pair of edges that merely shares neither endpoint; widening it to that
// general case is exactly what broke the ampersand golden file during this
// fix's own development.

/** Cells already claimed by a drawn edge, keyed by "x,y", storing which
 * edge (by reference) drew there — independent of `EdgeCellStyles` above,
 * which tracks *style* rather than edge identity. */
export type EdgeCellOwners = Map<string, AsciiEdge>

export function createEdgeCellOwners(): EdgeCellOwners {
  return new Map()
}

/**
 * Whether `a` and `b` form a chain through a shared intermediate node: one
 * edge's target is the other's source. Deliberately narrower than "shares
 * any endpoint" — a fan-in/fan-out pair (shared `from` or shared `to`) is
 * excluded on purpose, since that is exactly the shape a legitimate shared
 * trunk (bundled or not — see module doc) already routes through common
 * cells for.
 */
function isChainPair(a: AsciiEdge, b: AsciiEdge): boolean {
  return a.to === b.from || b.to === a.from
}

/**
 * Minimum number of open, non-node cells a chain pair must share before it
 * counts as a real conflict. A single shared cell is an ordinary crossing
 * (two independent lines passing through the same point, which still reads
 * as two lines) — it takes a *run* of shared cells, long enough to read as
 * one continuous connector, to actually mislead a reader. Chosen to be the
 * smallest value that catches a shared corner-to-corner leg (at least 2
 * collinear cells) while still letting a lone crossing through.
 */
const MIN_CHAIN_OVERLAP = 2

/**
 * The first open (non-node-occupied) cell in `path` already claimed by a
 * different edge that forms a chain with `edge` (`isChainPair`) — but only
 * once the pair's total overlap reaches `MIN_CHAIN_OVERLAP` cells (see that
 * constant's doc). Returns `null` when the owning edge isn't a chain
 * partner, the overlap is only an incidental single-cell crossing, or there
 * is none.
 */
export function findUnrelatedOverlap(
  grid: Grid,
  owners: EdgeCellOwners,
  path: readonly GridCoord[],
  edge: AsciiEdge,
): GridCoord | null {
  let firstConflict: GridCoord | null = null
  let overlapCount = 0
  for (const cell of pathCells(path)) {
    if (isOccupied(grid, cell)) continue
    const owner = owners.get(gridKey(cell))
    if (owner === undefined || owner === edge) continue
    if (!isChainPair(owner, edge)) continue
    overlapCount++
    if (firstConflict === null) firstConflict = cell
  }
  return overlapCount >= MIN_CHAIN_OVERLAP ? firstConflict : null
}

/**
 * Record every open (non-node-occupied) cell in `path` as claimed by
 * `edge`. First claim per cell wins, mirroring `claimPathCells` above.
 */
export function claimPathOwners(
  grid: Grid,
  owners: EdgeCellOwners,
  path: readonly GridCoord[],
  edge: AsciiEdge,
): void {
  for (const cell of pathCells(path)) {
    if (isOccupied(grid, cell)) continue
    const key = gridKey(cell)
    if (!owners.has(key)) owners.set(key, edge)
  }
}
