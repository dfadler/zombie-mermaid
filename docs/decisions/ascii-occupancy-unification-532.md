# ASCII collision-avoidance stays triplicated for now (issue #532 scoping)

## Context

Issue [#532](https://github.com/dfadler/zombie-mermaid/issues/532) observes that
the same conceptual bug — two rendered elements wanting the same row/column/label
lane — has been fixed independently, in three different data shapes, in three ASCII
renderers:

- `src/ascii/er-diagram.ts` — `isRowFree`/`chooseFreeRow` (`~line 213-293`)
- `src/ascii/class-diagram.ts` — `boxOccupancy`/`isInsideBox`/`findClearColumn`
  (`~line 574-652`) plus a separate `territoryByRel` label-collision map
  (`~line 1246-1340`)
- `src/ascii/sequence.ts` — strict sequential `curY` advancement plus ad hoc
  self-loop/destroy-row reservation (`~line 490-528`)

None of the three import `src/ascii/pathfinder.ts` (A* routing) or
`src/ascii/grid-occupancy.ts` (the `Grid` occupancy structure) that flowchart/state
ASCII already share via `src/ascii/converter.ts`. The issue's proposed direction:
extract "find a free lane near a preferred position, reserve a label's territory"
into one occupancy interface backed by the existing `Grid`, with sequence/ER/class
becoming callers instead of reimplementers.

This issue explicitly asked for scoping/feasibility first ("No behavior change is
proposed; this is a deepening opportunity to look into later"), not a guaranteed
implementation — this doc is that scoping pass. No code changes ship with it.

### Status of #531 at time of writing

Issue [#531](https://github.com/dfadler/zombie-mermaid/issues/531) (a label-vs-label
row collision bug in `class-diagram.ts`'s `territoryByRel` mechanism) is **open,
unfixed**. Its branch (`issue-531-class-label-collision`) exists but has zero
commits ahead of `main` (`git log main..issue-531-class-label-collision` is empty) —
no one has started the fix yet. This matters for #532 because #531 is a bug in the
exact mechanism this issue proposes unifying: unifying now would carry the bug
into the shared module; whoever picks up #531 should fix it in
`class-diagram.ts` first (or fix it as part of any future unification), rather than
this doc's scoping work masking it as "current behavior to preserve."

## Per-renderer feasibility assessment

The core finding: **the three renderers' occupancy data isn't just differently
shaped, it lives in different coordinate spaces with different truth models.**
That's a harder mismatch than "three call sites, one refactor."

### `er-diagram.ts` — canvas-content-derived, no separate reservation store

`isRowFree`/`chooseFreeRow` don't consult a reservation structure at all — they
scan the **already-rendered character canvas** (`Canvas`, a column-major
`string[][]`) directly: a cell counts as occupied if `col[y] !== ' '` and drawn
(`col === undefined` means "not painted yet," treated as free — see the doc
comment at `er-diagram.ts:213-226`, which explicitly documents this as
load-bearing: labels routinely land past the initial canvas bounds and grow it on
write). There is no `Set<"x,y">` anywhere in this file's collision logic; the
canvas itself *is* the occupancy map, and it is always in sync with what's drawn
because it's the same object.

Retrofitting this onto `Grid` would mean maintaining a **second, independent**
occupancy record (`grid.add(gridKey(...))`) in parallel with every canvas write
across the whole file — box borders, jogs, labels, everything `setC`/
`writeTextCells`-shaped touches. Two consequences:

- It's a materially larger diff than "swap `isRowFree` for `grid.isFree`" — every
  draw call site needs a matching reservation call, in the same order the canvas
  writes happen (since `chooseFreeRow`'s search depends on what's been drawn
  *so far*, not the final picture).
  Exact-string-equality tests would catch a *behavior* regression, but not the
  *architectural* regression of now having two sources of truth that could drift
  on a future edit — a bug class this file structurally cannot have today (there
  is only one canvas, so "free" and "drawn" can never disagree).
- `Grid`'s coordinate space (`GridCoord`, reserved via `NODE_BLOCK_SIZE`-sized
  blocks, see `grid-occupancy.ts:89-171`) is logical/coarse — built for
  flowchart/state's node-and-A*-edge model via `converter.ts`. ER's canvas
  coordinates are real character cells. `Grid`'s primitives (`isFree`,
  `isBlockFree`, `placeBlock`) are granularity-agnostic (`size` defaults to 3 but
  is a parameter), so using `Grid` at `size=1` for raw canvas cells is
  *mechanically* possible — but it's then just a same-shaped `Set<string>`
  duplicating what the canvas already tells you for free, for no behavior gain.

**Assessment: retrofittable, but not favorably.** The migration is safe to attempt
(byte-identical output is testable), but it trades a today-impossible bug class
(occupancy/canvas drift) for a "looks unified" win. Not recommended as a literal
`Grid`-backed migration.

### `class-diagram.ts` — box rectangles + a separate label-interval map

`boxOccupancy`/`isInsideBox`/`findClearColumn` (`~574-652`) work over **box
rectangles** (`{x1,x2,y1,y2}` in canvas-pixel coordinates, one per placed class),
testing point-in-any-rectangle — not a per-cell reservation scan. Interestingly,
`boxOccupancy` (the array itself, built at `line 576`) is **dead code**: nothing
reads it. `isInsideBox` iterates `placed.values()` directly (`line 592`), never
`boxOccupancy`. This looks like a vestige of an earlier implementation that
switched to iterating `placed` and never removed the now-unused array — worth a
one-line cleanup (flagged separately below; out of scope for this issue's
no-behavior-change constraint since it's an unrelated dead-code trim, not part of
unifying anything).

`territoryByRel` (`~1246-1340`) is a genuinely separate mechanism: a 1-D interval
allocator over label midpoints (`idealMidX`), splitting contested horizontal space
between two labels whose rows overlap. It has no notion of a 2-D grid at all — it's
closer to an interval-scheduling problem than an occupancy-map problem.

Migrating `isInsideBox`/`findClearColumn` to `Grid` faces the same granularity
mismatch as ER (rectangles in real canvas-pixel space vs. `Grid`'s logical
node-block space), but *unlike* ER, class-diagram's box list is small (one entry
per class) and static once placement finishes — so representing it as reserved
`Grid` cells (`size=1`, one `placeBlock`-equivalent call per box's full rectangle
at layout time) is more plausible than ER's "occupancy tracks a canvas that's still
being painted" problem: class boxes don't move or grow after placement, so there's
one clean "reserve all boxes" step rather than continuous interleaved
reserve/query. `territoryByRel`, though, has no obvious `Grid`-shaped
representation at all — it isn't a 2-D occupancy question, and forcing it into one
would be a bigger behavior-risking rewrite than the issue's "no behavior change"
framing supports.

**Assessment: partially retrofittable** (the box/column part), **but the label
interval allocator doesn't fit the proposed `Grid`-backed model at all** — it would
need its own separate shared primitive (a generic "split contested 1-D territory"
utility), not `Grid`. Also blocked in practice by #531 being an open, unfixed bug in
this exact mechanism (see above) — unifying now risks freezing that bug into a
shared module before it's even fixed.

### `sequence.ts` — no occupancy structure; correct by construction

This file's own header comment already says it plainly (`sequence.ts:8-9`):
*"Layout is fundamentally different from flowcharts — no grid or A* pathfinding.
Instead: actors → columns, messages → rows, all positioned linearly."*

There is no search-for-a-free-slot logic here at all, self-loop included. `curY`
advances monotonically (`~line 411-584`); a self-message just adds
`2 + msgLineCount` rows (`line 507`) and a destroyed-actor cross adds one more
(`line 526-527`) — pure sequential space allocation, not "am I colliding with
something, let me look elsewhere." Collisions are structurally impossible because
every message and gap is accounted for exactly once in a strictly increasing
counter; there is nothing analogous to `chooseFreeRow`'s "scan outward for a free
row" or `findClearColumn`'s "scan sideways for a free column" to extract.

**Assessment: not retrofittable, because there's nothing to retrofit.** The issue's
own description ("sidesteps via strict sequential curY advancement... a third
independent positioning model") is accurate, but "sidesteps" undersells it: this
isn't a third occupancy *implementation* solving the same problem in a different
shape, it's a different problem (no lane contention exists in the first place,
by design). Folding sequence.ts into a shared occupancy interface would mean
inventing a collision scenario for it to guard against that the current design
provably cannot produce — pure risk, no bug-class removed. Sequence.ts should
stay out of any unification.

## Shared-interface sketch (if this is ever pursued)

The deletion test in the issue ("deleting `chooseFreeRow`/`findClearColumn`/
`territoryByRel` would reintroduce #351-shaped bugs") is really about **the search
algorithm**, not the storage backend — `chooseFreeRow` and `findClearColumn` are
both "start at a preferred position, scan outward alternating in the two
directions, stop at the first candidate that clears a caller-supplied region
check" (er-diagram's `chooseFreeRow` even literally does the "below, then above,
alternating" walk that `findClearColumn` does "right, then left, alternating").
That's the real duplication, and it's a small, storage-agnostic pattern. A shared
module could reasonably be:

```ts
// src/ascii/lane-search.ts (sketch — not implemented)

/** A caller-supplied predicate: is this whole candidate region clear? */
type RegionFree = (candidate: number) => boolean

/**
 * Search outward from `preferred`, alternating +1/-1 offsets, for the first
 * candidate in (min, max) that `isFree` accepts. Falls back to `preferred`
 * if nothing in range is free. This is chooseFreeRow's row search and
 * findClearColumn's column search, generalized over one free axis — each
 * caller supplies its own occupancy check (canvas scan, box-rectangle test,
 * Grid lookup, whatever fits that renderer) rather than a shared storage type.
 */
function findFreeLane(
  preferred: number,
  min: number,
  max: number,
  isFree: RegionFree,
): number

/**
 * Split a set of 1-D intervals (label midpoints + widths) that overlap in a
 * second, orthogonal dimension (row span) into mutually exclusive territory,
 * generalizing class-diagram's territoryByRel. Storage-agnostic: callers pass
 * plain {id, idealMid, naturalStart, naturalEnd, rowStart, rowEnd} records.
 */
function allocateTerritory<T>(
  items: readonly T[],
  geometry: (item: T) => { idealMid: number; start: number; end: number; rowStart: number; rowEnd: number },
): Map<T, { left: number; right: number }>
```

Each renderer would keep its own occupancy *check* (ER: canvas scan; class:
box-rectangle test; flowchart/state: `Grid.isFree`) and pass it as the `isFree`
callback — no renderer is forced onto `Grid`'s coordinate space or storage model.
This unifies the *algorithm* (and gets it one shared, well-tested implementation
and one shared regression-test suite instead of three near-duplicates) without
unifying the *storage*, which is what the per-renderer feasibility section above
shows is the actually-hard, actually-risky part of the issue's proposed direction.

Sequence.ts would not become a caller of either function — see its assessment
above.

## Recommendation

- **Do not attempt the literal "back everything with `Grid`" unification.** ER's
  canvas-is-the-truth model and class-diagram's static-rectangle model are both
  representable as `Grid` cells mechanically, but doing so replaces a
  today-impossible bug class (occupancy/reality drift) with a real one, for a
  refactor that doesn't reduce risk anywhere it matters. Sequence.ts has nothing
  to unify at all.
- **The narrower, safer win is extracting the search *algorithm*** (`findFreeLane`
  generalizing `chooseFreeRow`/`findClearColumn`) as sketched above — genuinely
  storage-agnostic, genuinely testable in isolation, and it directly targets the
  issue's own deletion test (the algorithm, not the backing array, is what
  prevents #351-shaped regressions). This is still a nontrivial refactor of two
  1000+ line files and was judged out of scope for this scoping pass to attempt
  live — see "Why no code change shipped" below.
- **`territoryByRel`'s 1-D interval allocator is a separate, smaller unification
  candidate** (`allocateTerritory` above) independent of the row/column lane
  search, and is currently blocked on #531 landing a fix first so any extraction
  starts from correct behavior rather than freezing a known bug into a shared
  utility.
- **Do not fold `sequence.ts` into this effort.** Its lack of an occupancy
  structure is a feature of its design (collision-proof by construction), not a
  gap.

### Why no code change shipped with this scoping pass

The task framing explicitly allows (but does not require) a safe, incremental
first step "e.g. just migrating ER to use the shared Grid... with full regression
tests" — and explicitly says to prefer just delivering the scoping doc over a
partial attempt if that migration isn't confidently safe. Per the ER assessment
above, a `Grid`-backed migration for ER is mechanically achievable but trades one
bug class for another (dual-source-of-truth risk) without a real payoff, so it
does not clear the "confidently safe and worth doing" bar this task set — the
byte-identical-output test bar only proves the *output* didn't change today, not
that the new redundant bookkeeping is safe against future edits. The
algorithm-only extraction (`findFreeLane`) sketched above is the safer path, but
touches search logic embedded deep in both `er-diagram.ts`'s relationship-drawing
loop and `class-diagram.ts`'s detour-routing loop (both files are 1200-1600 lines
with dense, cross-referencing inline comments documenting specific historical bug
fixes — #351, #447, #448, #487, #489 are all cited inline near this code), and
class-diagram's half is entangled with the still-open #531. Attempting that
extraction inside this same scoping pass risked exactly the "botched attempt
across diagram types" outcome the task asked to avoid. It's left as a
concretely-scoped follow-up (the sketch above) rather than attempted here.

## Consequences

- No behavior change ships with this doc, matching the issue's own framing.
- A follow-up issue extracting `findFreeLane` (ER + class-diagram row/column
  search) can reference this doc and the sketch above directly rather than
  re-deriving the analysis.
- A follow-up issue for `allocateTerritory` (class-diagram's label-territory
  logic) should wait on #531's fix landing first.
- `sequence.ts` is excluded from any future occupancy-unification issue; if a
  future sequence-diagram feature ever needs real collision avoidance (e.g.
  overlapping self-loops with independently-computed rows), that would be new
  functionality, not a retrofit of existing behavior, and can consider
  `findFreeLane` at that point on its own merits.
- The dead `boxOccupancy` array in `class-diagram.ts` (`line 576-584`) is an
  unrelated, low-risk cleanup opportunity spotted during this scoping pass —
  flagged separately rather than bundled into this no-behavior-change issue.
