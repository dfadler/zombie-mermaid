// ============================================================================
// ASCII renderers — shared "nearest free lane" search
//
// `er-diagram.ts` (`chooseFreeRow`) and `class-diagram.ts`
// (`findClearColumn`) independently grew the same search: start at a
// preferred row/column, and if that one is occupied, walk outward one step
// at a time — forward first, then backward — until a candidate passes the
// caller's occupancy check.
//
// Only the *search order* is shared here. The occupancy check itself stays
// with each renderer and arrives as a callback, because the two renderers
// answer "is this lane usable?" from genuinely different sources: ER scans
// the rendered canvas itself, while class-diagram tests against the placed
// box rectangles. Unifying that *storage* was scoped out as unsafe — see
// `docs/decisions/ascii-occupancy-unification-532.md` (issue #532) — so this
// module deliberately extracts the algorithm and nothing else.
// ============================================================================

/**
 * Caller-supplied occupancy check: whether the whole region a candidate
 * lane would occupy is usable. Called at most once per candidate, and only
 * for candidates already inside `[min, max]` (plus `preferred`, see below),
 * so an expensive check isn't run on lanes that would be rejected anyway.
 */
export type LaneFree = (candidate: number) => boolean

/**
 * Find the nearest usable lane (a row or a column) to `preferred`, scanning
 * outward in alternating directions and stopping at the first candidate
 * `isFree` accepts.
 *
 * Search order: `preferred`, then `preferred + 1`, `preferred - 1`,
 * `preferred + 2`, `preferred - 2`, … — the forward direction is always
 * tried first at each distance, which is what both original call sites did
 * (ER scanned below-then-above; class-diagram right-then-left).
 *
 * `min`/`max` are *inclusive* bounds on the outward candidates only.
 * `preferred` itself is tested unconditionally, even when it falls outside
 * them: both call sites relied on that. ER's bounds are the open interval
 * between two entity borders, so a gap too narrow to hold any candidate row
 * still lets the plain midpoint through; class-diagram's `min` of 0 keeps
 * the search on-canvas while `preferred` is a box's own centre column.
 *
 * Returns `undefined` when no candidate in range is free — including when
 * `min > max` leaves no candidates at all. Each caller supplies its own
 * fallback for that case (they differ), rather than this function inventing
 * one.
 */
export function findFreeLane(
  preferred: number,
  min: number,
  max: number,
  isFree: LaneFree,
): number | undefined {
  if (isFree(preferred)) return preferred

  // Far enough to reach whichever bound is further from `preferred`; beyond
  // that every remaining candidate is out of range in both directions.
  const maxOffset = Math.max(preferred - min, max - preferred)
  for (let offset = 1; offset <= maxOffset; offset++) {
    const forward = preferred + offset
    if (forward <= max && isFree(forward)) return forward
    const backward = preferred - offset
    if (backward >= min && isFree(backward)) return backward
  }

  return undefined
}
