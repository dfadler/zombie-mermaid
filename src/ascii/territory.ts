// ============================================================================
// ASCII renderer — 1-D territory allocation
//
// Splits contested horizontal space between items (labels) whose row spans
// overlap, giving each a mutually exclusive [left, right] column range
// derived purely from geometry — never from draw order or from what an
// earlier item happened to render as.
//
// Extracted from `class-diagram.ts`'s `territoryByRel` precompute (issue
// #618). It stayed out of the shared `Grid` occupancy model (issue #532)
// deliberately: this is a 1-D interval-scheduling problem over item
// midpoints, not a 2-D occupancy map, so there is nothing to reserve and
// nothing to look up per cell. Keeping it storage-agnostic — the caller
// supplies geometry, this module supplies only the allocation — means a
// second renderer can adopt it without first adopting a grid.
// ============================================================================

/**
 * One item's placement geometry, in whatever units the caller works in
 * (columns and rows, for the ASCII renderers).
 *
 * `start`/`end` describe the item's *natural* span — where it would sit if
 * nothing else competed for the space — and must already be clamped exactly
 * the way the caller's own draw pass clamps it. Passing an unclamped span
 * under-detects real collisions: an item pinned at the canvas edge draws at
 * column 0 but would be compared here as if it were still off-canvas at its
 * raw negative position, so the overlap with its neighbour is missed
 * entirely (issue #447).
 *
 * `rowStart`/`rowEnd` are inclusive and must likewise be the item's *final*
 * resolved rows, not a pre-fallback ideal: two items whose ideal rows don't
 * overlap can still resolve onto the same actual row, and a territory
 * computed from the ideal rows leaves them unsplit — so the later one's
 * draw silently overwrites the earlier one's (issue #531).
 */
export interface TerritoryGeometry {
  /** The item's preferred centre along the allocated axis. */
  idealMid: number
  /** Inclusive first column of the item's natural (uncontested) span. */
  start: number
  /** Inclusive last column of the item's natural (uncontested) span. */
  end: number
  /** Inclusive first row the item occupies. */
  rowStart: number
  /** Inclusive last row the item occupies. */
  rowEnd: number
}

/**
 * The columns an item may draw into, inclusive on both sides. An
 * unconstrained side is `-Infinity` / `Infinity` rather than a sentinel
 * number, so a caller can clamp or compare without special-casing.
 */
export interface Territory {
  left: number
  right: number
}

/** Whether two items' row spans actually intersect. */
function rowsOverlap(a: TerritoryGeometry, b: TerritoryGeometry): boolean {
  return a.rowStart <= b.rowEnd && b.rowStart <= a.rowEnd
}

/**
 * Allocate each item a horizontal territory, splitting contested space
 * evenly at the midpoint between two competing items' `idealMid` values.
 *
 * Two items are competitors only when *both* their row spans intersect and
 * their natural spans overlap; anything else leaves both sides unconstrained
 * (`±Infinity`). Competitors are found by scanning outward in `idealMid`
 * order for the nearest row-overlapping item on each side — not by stopping
 * at the immediately adjacent one, since a non-colliding item can sit
 * between two that genuinely do collide (issue #531).
 *
 * Allocating up front, before anything is drawn, is what makes placement
 * independent of iteration order. A *reactive* approach — only avoiding
 * cells an earlier iteration already wrote — cascades: one item shifted into
 * view at the canvas edge eats its neighbour's rightful columns, that
 * neighbour then has nothing left to claim and vanishes, and everything
 * after it drifts based on the leftovers. With fixed, mutually exclusive
 * territories, a genuinely insufficient width truncates every competitor
 * consistently instead of destroying an arbitrary subset (issue #447).
 *
 * `geometry` is called exactly once per item, in `items` order. Items
 * tying on `idealMid` keep their `items` order (the sort is stable).
 *
 * @param items Items to allocate for, in any order.
 * @param geometry Extracts an item's placement geometry.
 * @returns Each item mapped to its allocated territory. Every item in
 * `items` is present; passing the same item reference twice yields one
 * entry (the last one allocated).
 */
export function allocateTerritory<T>(
  items: readonly T[],
  geometry: (item: T) => TerritoryGeometry,
): Map<T, Territory> {
  const ordered = items
    .map((item) => ({ item, geom: geometry(item) }))
    .sort((a, b) => a.geom.idealMid - b.geom.idealMid)

  /**
   * The nearest entry in `dir` (-1 left, +1 right) from `idx`, by `idealMid`
   * order, whose rows actually overlap `ordered[idx]`'s — skipping over any
   * immediately-adjacent entries that don't.
   */
  const nearestRowOverlapping = (
    idx: number,
    dir: -1 | 1,
  ): TerritoryGeometry | undefined => {
    const g = ordered[idx]
    if (!g) return undefined
    for (let j = idx + dir; j >= 0 && j < ordered.length; j += dir) {
      const candidate = ordered[j]
      if (candidate && rowsOverlap(candidate.geom, g.geom))
        return candidate.geom
    }
    return undefined
  }

  const territories = new Map<T, Territory>()
  for (const [i, entry] of ordered.entries()) {
    const g = entry.geom
    const prev = nearestRowOverlapping(i, -1)
    const next = nearestRowOverlapping(i, 1)
    const left =
      prev && prev.end >= g.start
        ? Math.floor((prev.idealMid + g.idealMid) / 2) + 1
        : -Infinity
    const right =
      next && g.end >= next.start
        ? Math.floor((g.idealMid + next.idealMid) / 2)
        : Infinity
    territories.set(entry.item, { left, right })
  }
  return territories
}
