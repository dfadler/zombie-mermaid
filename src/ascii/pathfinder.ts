// ============================================================================
// ASCII renderer — A* pathfinding for edge routing
//
// Ported from AlexanderGrooff/mermaid-ascii cmd/arrow.go.
// Uses A* search with a corner-penalizing heuristic to find clean
// paths between nodes on the grid. Prefers straight lines over zigzags.
// ============================================================================

import type {
  GridCoord,
  AsciiNode,
  PathBudget,
  AsciiGraph,
  CardinalDirection,
} from './types.ts'
import { gridKey, gridCoordEquals, dirEquals, Left, Right } from './types.ts'

// ============================================================================
// Priority queue (min-heap) for A* open set
// ============================================================================

interface PQItem {
  coord: GridCoord
  priority: number
}

/**
 * Simple min-heap priority queue.
 * For the grid sizes we handle (~100s of cells), this is more than fast enough.
 */
class MinHeap {
  private items: PQItem[] = []

  get length(): number {
    return this.items.length
  }

  push(item: PQItem): void {
    this.items.push(item)
    this.bubbleUp(this.items.length - 1)
  }

  pop(): PQItem | undefined {
    if (this.items.length === 0) return undefined
    const top = this.items[0]!
    const last = this.items.pop()!
    if (this.items.length > 0) {
      this.items[0] = last
      this.sinkDown(0)
    }
    return top
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.items[i]!.priority < this.items[parent]!.priority) {
        ;[this.items[i], this.items[parent]] = [
          this.items[parent]!,
          this.items[i]!,
        ]
        i = parent
      } else {
        break
      }
    }
  }

  private sinkDown(i: number): void {
    const n = this.items.length
    while (true) {
      let smallest = i
      const left = 2 * i + 1
      const right = 2 * i + 2
      if (
        left < n &&
        this.items[left]!.priority < this.items[smallest]!.priority
      ) {
        smallest = left
      }
      if (
        right < n &&
        this.items[right]!.priority < this.items[smallest]!.priority
      ) {
        smallest = right
      }
      if (smallest !== i) {
        ;[this.items[i], this.items[smallest]] = [
          this.items[smallest]!,
          this.items[i]!,
        ]
        i = smallest
      } else {
        break
      }
    }
  }
}

// ============================================================================
// A* heuristic
// ============================================================================

/**
 * Manhattan distance with a +1 penalty when both dx and dy are non-zero.
 * This encourages the pathfinder to prefer straight lines and minimize corners.
 */
export function heuristic(a: GridCoord, b: GridCoord): number {
  const absX = Math.abs(a.x - b.x)
  const absY = Math.abs(a.y - b.y)
  if (absX === 0 || absY === 0) {
    return absX + absY
  }
  return absX + absY + 1
}

// ============================================================================
// A* pathfinding
// ============================================================================

/** 4-directional movement (no diagonals in grid pathfinding). */
const MOVE_DIRS: GridCoord[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
]

/** Check if a grid cell is unoccupied and has non-negative coordinates. */
export function isFreeInGrid(
  grid: Map<string, AsciiNode>,
  c: GridCoord,
): boolean {
  if (c.x < 0 || c.y < 0) return false
  return !grid.has(gridKey(c))
}

/**
 * Maximum number of A* iterations before giving up on a *single* getPath
 * call. Prevents unbounded memory growth when the destination is
 * unreachable through free cells (the grid has no positive upper-bound
 * check).
 *
 * This alone is not sufficient to bound a whole render: a dense fan-in/out
 * graph can call getPath hundreds of times (once per edge, sometimes twice
 * — see determinePath's preferred + alternative attempts), and each call is
 * independently allowed to spend up to MAX_ITERATIONS work searching a grid
 * that's mostly occupied by other nodes on the same row. That per-call cap
 * bounds each search but not their sum, so total time/memory across a
 * render still scales with (edge count × MAX_ITERATIONS) and can exhaust
 * the heap well before any single call hits its own limit. See PathBudget
 * below for the render-wide bound that fixes this.
 */
const MAX_ITERATIONS = 50_000

/**
 * A mutable, render-wide budget shared across every getPath call made while
 * laying out one graph (see grid.ts's createMapping, which creates one
 * fresh budget per render and threads it through edge-routing.ts and
 * edge-bundling.ts). Each A* iteration — in any call — decrements
 * `remaining`; once it hits zero, all subsequent getPath calls return null
 * immediately (falling back to the direct-path logic already used when A*
 * can't find a route at all), which hard-bounds total pathfinding work for
 * the whole render regardless of how many edges it has.
 *
 * (Type defined in types.ts alongside the other shared ASCII-renderer
 * types, to avoid a circular import between this module and types.ts.)
 */

/**
 * Default render-wide iteration budget. Generous enough to fully route
 * ordinary diagrams (tens to low hundreds of edges) without ever being
 * hit, while still keeping total pathfinding work — and thus memory use —
 * bounded for pathological dense fan-in/out graphs with hundreds of edges.
 */
export const DEFAULT_PATH_BUDGET = 200_000

/** Create a fresh render-wide path budget. */
export function createPathBudget(
  total: number = DEFAULT_PATH_BUDGET,
): PathBudget {
  return { remaining: total }
}

/**
 * Find a path from `from` to `to` on the grid using A*.
 * Returns the path as an array of GridCoords, or null if no path exists.
 *
 * `budget`, if provided, is a render-wide iteration budget shared across
 * all getPath calls for the current layout — see PathBudget above. Once
 * exhausted, this (and every subsequent call sharing it) returns null
 * right away instead of searching.
 */
export function getPath(
  grid: Map<string, AsciiNode>,
  from: GridCoord,
  to: GridCoord,
  budget?: PathBudget,
): GridCoord[] | null {
  if (budget && budget.remaining <= 0) {
    return null
  }

  const pq = new MinHeap()
  pq.push({ coord: from, priority: 0 })

  const costSoFar = new Map<string, number>()
  costSoFar.set(gridKey(from), 0)

  const cameFrom = new Map<string, GridCoord | null>()
  cameFrom.set(gridKey(from), null)

  let iterations = 0
  while (pq.length > 0) {
    if (++iterations > MAX_ITERATIONS) {
      return null
    }
    if (budget) {
      if (budget.remaining <= 0) return null
      budget.remaining--
    }

    const current = pq.pop()!.coord

    if (gridCoordEquals(current, to)) {
      // Reconstruct path by walking backwards through cameFrom
      const path: GridCoord[] = []
      let c: GridCoord | null = current
      while (c !== null) {
        path.unshift(c)
        c = cameFrom.get(gridKey(c)) ?? null
      }
      return path
    }

    // Every coord ever pushed onto `pq` has its costSoFar entry set
    // immediately beforehand — either the initial `from` push above, or in
    // the neighbor-expansion loop below (`costSoFar.set` precedes
    // `pq.push`) — so a coord just popped from `pq` always has a recorded
    // cost. That invariant lives in this function's control flow, not in
    // the Map's type, so it's checked explicitly rather than trusted via
    // `!`.
    const currentCost = costSoFar.get(gridKey(current))
    if (currentCost === undefined) {
      /* v8 ignore next */
      throw new Error(
        `A* pathfinding: missing cost for visited cell ${gridKey(current)}`,
      )
    }

    for (const dir of MOVE_DIRS) {
      const next: GridCoord = { x: current.x + dir.x, y: current.y + dir.y }

      // Allow moving to the destination even if it's occupied (it's a node boundary)
      if (!isFreeInGrid(grid, next) && !gridCoordEquals(next, to)) {
        continue
      }

      const newCost = currentCost + 1
      const nextKey = gridKey(next)
      const existingCost = costSoFar.get(nextKey)

      if (existingCost === undefined || newCost < existingCost) {
        costSoFar.set(nextKey, newCost)
        const priority = newCost + heuristic(next, to)
        pq.push({ coord: next, priority })
        cameFrom.set(nextKey, current)
      }
    }
  }

  return null // No path found
}

/**
 * Simplify a path by removing intermediate waypoints on straight segments.
 * E.g., [(0,0), (1,0), (2,0), (2,1)] becomes [(0,0), (2,0), (2,1)].
 * This reduces the number of line-drawing operations.
 */
export function mergePath(path: GridCoord[]): GridCoord[] {
  if (path.length <= 2) return path

  const toRemove = new Set<number>()
  let step0 = path[0]!
  let step1 = path[1]!

  for (let idx = 2; idx < path.length; idx++) {
    const step2 = path[idx]!
    const prevDx = step1.x - step0.x
    const prevDy = step1.y - step0.y
    const dx = step2.x - step1.x
    const dy = step2.y - step1.y

    // Same direction — the middle point is redundant
    if (prevDx === dx && prevDy === dy) {
      // In Go: indexToRemove = append(indexToRemove, idx+1) but idx is 0-based from path[2:]
      // which corresponds to index idx in the full path. Go uses idx+1 because idx iterates
      // from 0 in the [2:] slice, mapping to full-array index idx+1.
      // Actually re-checking Go code: the loop is `for idx, step2 := range path[2:]`
      // so idx=0 → path[2], and it removes idx+1 which is index 1 in the full array.
      // Wait, that doesn't look right. Let me re-read:
      //   step0 = path[0], step1 = path[1]
      //   for idx, step2 := range path[2:] { ... indexToRemove = append(indexToRemove, idx+1) ... }
      //   When idx=0, step2=path[2], and it removes index 1 (step1 = path[1]) if directions match
      // So it removes the middle point (step1) which is at index idx+1 in the original array
      // when counting from the 2-ahead loop. Let me just track which middle indices to remove.
      toRemove.add(idx - 1) // Remove the middle point (step1's position)
    }

    step0 = step1
    step1 = step2
  }

  return path.filter((_, i) => !toRemove.has(i))
}

// ============================================================================
// Direct (unobstructed L-shape) path — shared fast path for edge-routing.ts
// and edge-bundling.ts
// ============================================================================

/**
 * Check every cell strictly after `from` up to (and optionally including)
 * `to` along a single axis-aligned run. `from` and `to` must share an x or
 * a y coordinate. `includeTo` should be false when `to` is the edge's
 * final destination point (which is expected to sit on/adjacent to the
 * target node's own border and so may legitimately be "occupied" in
 * graph.grid — mirroring the same allowance A*'s getPath makes for its
 * destination cell).
 */
function isAxisRunFree(
  grid: Map<string, AsciiNode>,
  from: GridCoord,
  to: GridCoord,
  includeTo: boolean,
): boolean {
  if (from.x === to.x && from.y === to.y) return true
  const alongY = from.x === to.x
  if (!alongY && from.y !== to.y) return false // not axis-aligned

  const step = alongY ? (to.y > from.y ? 1 : -1) : to.x > from.x ? 1 : -1
  let pos = alongY ? from.y : from.x
  const end = alongY ? to.y : to.x

  for (pos += step; ; pos += step) {
    const isLast = pos === end
    const cell: GridCoord = alongY
      ? { x: from.x, y: pos }
      : { x: pos, y: from.y }
    if (!(isLast && !includeTo) && !isFreeInGrid(grid, cell)) return false
    if (isLast) break
  }
  return true
}

/** Try one L-shaped corner order; null if any leg is obstructed. */
function tryCornerPath(
  grid: Map<string, AsciiNode>,
  from: GridCoord,
  to: GridCoord,
  horizontalFirst: boolean,
): GridCoord[] | null {
  const corner: GridCoord = horizontalFirst
    ? { x: to.x, y: from.y }
    : { x: from.x, y: to.y }

  if (!isAxisRunFree(grid, from, corner, true)) return null
  if (!isAxisRunFree(grid, corner, to, false)) return null
  return [from, corner, to]
}

/**
 * Try a direct two-segment (L-shaped) route between `from` and `to`. `dir`
 * indicates the preferred corner order (horizontal-first for Left/Right,
 * vertical-first for Up/Down), but when that orientation is blocked the
 * *other* orientation is tried too before giving up.
 *
 * Trying both orientations (rather than trusting `dir` alone) matters
 * because `dir` is not always the true geometric departure direction from
 * `from`: edge-routing.ts's determinePath always passes it correctly, but
 * edge-bundling.ts's junction segments sometimes pass the *arrival* anchor
 * at `to` instead (the two only coincide when `from`/`to` happen to already
 * be axis-aligned, which is common but not guaranteed — see the PR #178
 * review that found the fast path dead at 3 of 4 bundled call sites because
 * of exactly this mix-up). Trying both orientations makes the result
 * correct regardless of which direction a caller actually knows, instead of
 * requiring every caller to recompute true geometric departure.
 *
 * Returns null when `from` and `to` are already axis-aligned (no corner
 * needed — A*'s result is already optimal there) or when both orientations
 * are blocked.
 *
 * A* always finds a *shortest* path, but when several equally-short routes
 * exist — e.g. a straight line and a zigzag with the same total step count
 * — which one it returns depends on priority-queue tie-breaking order, not
 * on which "looks" straighter. That's why sibling edges from the same
 * source can end up with visually inconsistent routing (one goes straight,
 * another zigzags) even though nothing actually blocks a straight route
 * for either. A direct L-shaped route is, by construction, exactly as
 * short as any route between two points can be, so whenever it's
 * unobstructed we prefer it outright over whatever A* found — this also
 * skips the A* search entirely for the common unobstructed case.
 */
function tryDirectPath(
  graph: AsciiGraph,
  from: GridCoord,
  to: GridCoord,
  dir: CardinalDirection,
): GridCoord[] | null {
  if (from.x === to.x || from.y === to.y) return null

  const preferHorizontalFirst = dirEquals(dir, Left) || dirEquals(dir, Right)
  return (
    tryCornerPath(graph.grid, from, to, preferHorizontalFirst) ??
    tryCornerPath(graph.grid, from, to, !preferHorizontalFirst)
  )
}

/**
 * Route a single directed edge segment from `from` to `to`: try an
 * unobstructed direct L-shaped route first (tryDirectPath, above), falling
 * back to A* search (getPath) when every direct orientation is blocked or
 * unavailable (from/to already axis-aligned). Returns the merged path, or
 * null when neither strategy finds a route at all (e.g. the destination
 * is unreachable through free cells).
 *
 * This is the single seam both edge-routing.ts (determinePath's
 * preferred/alternative candidates) and edge-bundling.ts
 * (routeBundledEdges' junction-based segments) route through, so regular
 * and bundled edges share the same fast-path-then-A* behavior instead of
 * each independently calling getPath.
 *
 * `graph.pathBudget` is required, not silently optional: it's the
 * render-wide bound against pathological/hostile diagrams (see PathBudget
 * above), and routeEdge is the shared entry point for two modules now — an
 * absent budget here would silently disable that bound for both instead of
 * failing loudly, the way requireGridCoord fails loudly for a missing grid
 * coordinate rather than treating it as some default.
 */
export function routeEdge(
  graph: AsciiGraph,
  from: GridCoord,
  to: GridCoord,
  dir: CardinalDirection,
): GridCoord[] | null {
  if (!graph.pathBudget) {
    throw new Error(
      'routeEdge requires graph.pathBudget to be set; call createPathBudget() (see grid.ts createMapping) before routing edges',
    )
  }
  const path =
    tryDirectPath(graph, from, to, dir) ??
    getPath(graph.grid, from, to, graph.pathBudget)
  return path ? mergePath(path) : null
}
