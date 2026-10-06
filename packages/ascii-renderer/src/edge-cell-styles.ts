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

/** Cells already claimed by drawn edges, keyed by "x,y", storing every edge
 * (by reference) that drew there — independent of `EdgeCellStyles` above,
 * which tracks *style* rather than edge identity.
 *
 * Stores a `Set`, not a single edge: `graph.edges` order means an edge
 * unrelated to any chain can claim a cell before a real chain pair's own
 * edges do, and a single-owner map would let that unrelated edge's claim
 * hide the chain pair's overlap from `findUnrelatedOverlap` entirely. See
 * that function's own doc.
 */
export type EdgeCellOwners = Map<string, Set<AsciiEdge>>

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
 * Whether port-offsets.ts leaves `edge` where it was routed: self-loops,
 * bundled, lane, invisible and cluster edges. Such an edge is not drawn apart
 * from another at a shared port, so the port-sharing exemption below does not
 * apply to it. Lives here, not in port-offsets.ts, to keep this module free of
 * the layout imports that would make a cycle.
 */
export function isPortFixedEdge(edge: AsciiEdge): boolean {
  return (
    edge.from === edge.to ||
    edge.path.length < 2 ||
    edge.bundle !== undefined ||
    edge.parallelLane !== undefined ||
    edge.style === 'invisible' ||
    edge.clusterSource !== undefined ||
    edge.clusterTarget !== undefined
  )
}

/**
 * Cells where `owner` and a candidate `path` for `edge` meet at one node port
 * in opposite roles: one leaves the node by the port cell and the other
 * arrives at the very same cell, so their first (or last) legs run along the
 * same cells. port-offsets.ts draws two such edges one cell apart on the node's
 * side, so sharing those cells cannot read as one connector, and routing them
 * around each other only wraps one of them round the far side of the diagram
 * (#1349).
 *
 * Only a reciprocal pair (`A --> C` beside `C --> A`) qualifies. A true chain
 * (`Mobile App --> Gateway` then `Gateway --> User Service`) shares a node but
 * not both, and two strokes a cell apart on one row can still read as a single
 * connector through the node (#1067, #63), so a chain keeps being routed apart.
 * Cells further along either route are not exempt: nothing draws those apart.
 */
function portSharedCells(
  owner: AsciiEdge,
  edge: AsciiEdge,
  path: readonly GridCoord[],
): Set<string> {
  const shared = new Set<string>()
  if (isPortFixedEdge(owner) || isPortFixedEdge(edge)) return shared
  if (owner.from !== edge.to || owner.to !== edge.from) return shared
  const same = (a: GridCoord | undefined, b: GridCoord | undefined): boolean =>
    a !== undefined && b !== undefined && a.x === b.x && a.y === b.y
  const keysOf = (leg: GridCoord[]): Set<string> =>
    new Set(pathCells(leg).map(gridKey))
  const meet = (a: GridCoord[], b: GridCoord[]): void => {
    const bKeys = keysOf(b)
    for (const key of keysOf(a)) if (bKeys.has(key)) shared.add(key)
  }
  const ownerPath = owner.path
  if (ownerPath.length < 2 || path.length < 2) return shared
  const first = (p: readonly GridCoord[]): GridCoord[] => [p[0]!, p[1]!]
  const last = (p: readonly GridCoord[]): GridCoord[] => [
    p[p.length - 2]!,
    p[p.length - 1]!,
  ]
  // `owner` leaves the node `edge` arrives at, through the same port.
  if (owner.from === edge.to && same(ownerPath[0], path[path.length - 1])) {
    meet(first(ownerPath), last(path))
  }
  // `owner` arrives at the node `edge` leaves, through the same port.
  if (
    owner.to === edge.from &&
    same(ownerPath[ownerPath.length - 1], path[0])
  ) {
    meet(last(ownerPath), first(path))
  }
  return shared
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
 * A cluster-exit edge (cluster-boundary.ts) turns at the gutter cell right
 * beside the target's rank, so its last leg into the target can be a single
 * open cell — the very corner cell. A chain partner leaving the target
 * through that same face (`Error --> Idle` after `Processing --> Error`)
 * then retraces the leg and reads as a continuation of it, at just one
 * shared cell. For such an owner one shared cell is already a conflict.
 * Only an owner whose cluster-exit plan is active qualifies: an edge merely
 * addressed from a cluster (single exit, rejected plan) routes ordinarily.
 */
function chainOverlapThreshold(
  owner: AsciiEdge,
  isActiveClusterExit: (edge: AsciiEdge) => boolean,
): number {
  return isActiveClusterExit(owner) ? 1 : MIN_CHAIN_OVERLAP
}

/**
 * The first open (non-node-occupied) cell in `path` already claimed by a
 * different edge that forms a chain with `edge` (`isChainPair`) — but only
 * once *that specific chain partner's* total overlap with `edge` reaches
 * `MIN_CHAIN_OVERLAP` cells (see that constant's doc). Each distinct owner
 * of a cell is checked and counted independently — a cell can hold several
 * edges' claims (see `EdgeCellOwners`'s own doc), and an unrelated same-style
 * edge sharing a cell must not hide a real chain partner's overlap that also
 * claimed it. Returns `null` when no chain partner's overlap reaches the
 * threshold.
 */
export function findUnrelatedOverlap(
  grid: Grid,
  owners: EdgeCellOwners,
  path: readonly GridCoord[],
  edge: AsciiEdge,
  isActiveClusterExit: (edge: AsciiEdge) => boolean = () => false,
): GridCoord | null {
  const overlapCounts = new Map<AsciiEdge, number>()
  const firstConflicts = new Map<AsciiEdge, GridCoord>()
  const exempt = new Map<AsciiEdge, Set<string>>()
  const portShared = (owner: AsciiEdge): Set<string> => {
    let cells = exempt.get(owner)
    if (!cells) {
      cells = portSharedCells(owner, edge, path)
      exempt.set(owner, cells)
    }
    return cells
  }
  for (const cell of pathCells(path)) {
    if (isOccupied(grid, cell)) continue
    const cellOwners = owners.get(gridKey(cell))
    if (cellOwners === undefined) continue
    for (const owner of cellOwners) {
      if (owner === edge) continue
      if (!isChainPair(owner, edge)) continue
      if (portShared(owner).has(gridKey(cell))) continue
      overlapCounts.set(owner, (overlapCounts.get(owner) ?? 0) + 1)
      if (!firstConflicts.has(owner)) firstConflicts.set(owner, cell)
    }
  }
  for (const [owner, count] of overlapCounts) {
    if (count >= chainOverlapThreshold(owner, isActiveClusterExit))
      return firstConflicts.get(owner)!
  }
  return null
}

/**
 * Record every open (non-node-occupied) cell in `path` as claimed by
 * `edge`, alongside any edge(s) that already claimed it — see
 * `EdgeCellOwners`'s own doc for why a cell can have more than one owner.
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
    let cellOwners = owners.get(key)
    if (cellOwners === undefined) {
      cellOwners = new Set()
      owners.set(key, cellOwners)
    }
    cellOwners.add(edge)
  }
}
