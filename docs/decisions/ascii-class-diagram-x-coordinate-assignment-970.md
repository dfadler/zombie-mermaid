# ASCII class-diagram x-coordinate assignment (#970): a block-based priority method, not full Brandes-Köpf

Decision for [#970](https://github.com/dfadler/zombie-mermaid/issues/970),
staged from [#964](https://github.com/dfadler/zombie-mermaid/issues/964).
This is the design/decision stage only — no changes to
`packages/ascii-renderer/src/class-diagram.ts` accompany this doc. **Full
research — rejected alternatives (full Brandes-Köpf, per-node medians) and
why, the existing-defenses walkthrough, and the sample-catalog impact
simulation — is written up in
[#970's own design-notes comment](https://github.com/dfadler/zombie-mermaid/issues/970#issuecomment-5628076972).
This file is a short summary for implementers**, covering only what #971,
#972, and #973 need to act on.

## Problem

`class-diagram.ts` packs each level's classes strictly left-to-right in
declaration order
([`levelGroups`, lines 374-377](https://github.com/dfadler/zombie-mermaid/blob/main/packages/ascii-renderer/src/class-diagram.ts#L374-L377);
positioning loop,
[lines 562-596](https://github.com/dfadler/zombie-mermaid/blob/main/packages/ascii-renderer/src/class-diagram.ts#L562-L596)),
with no reference to any parent's column. A level with exactly one occupant
always lands at column 0, even when its real parent sits far away —
producing the long, confusing connector jog #964 reports. SVG doesn't have
this bug: ELK already runs Brandes-Köpf horizontal coordinate assignment
(`packages/svg-renderer/src/layout-engine/to-elk.ts`'s
`fixedAlignment: 'BALANCED'`) — confirmed via a side-by-side render of
#964's repro (see the linked comment for the exact output).

## Decision

**Adopt a block-based "priority method" — a simplified, integer-cell
predecessor of Brandes-Köpf, not the full algorithm.** Concretely:

1. Keep the existing level assignment (`level`/`levelGroups`) and
   declaration-order sibling ordering exactly as they are today — only
   _position_ changes, never _order_.

2. Within a level, group classes into **alignment blocks**: classes sharing
   the _exact same parent-id set_ form one block, processed as a unit
   (evaluating each child independently against its parent's center
   silently degrades back to today's left-packing for the common
   multiple-children case — see the linked comment for the simulation that
   found this).

3. For each level, in the level's existing declaration order:
   - A block counts as having **no resolvable parents** — and keeps its
     current left-to-right position — if it has no parent edges at all
     (a root), **or** every parent edge points to a class at the _same_
     level rather than a strictly shallower one (a rootless relationship
     cycle, e.g. `A --> B --> C --> A` with no external root: the
     level-BFS puts every member at level 0 together, but the semantic
     `parents` map still records each one's in-cycle predecessor — that
     predecessor isn't "already resolved" the way a true shallower parent
     is, so it doesn't qualify).
   - A block with at least one qualifying (strictly-shallower) parent
     computes its **desired center** as the mean of those parents' center
     columns, rounded to the nearest integer cell (`Math.round`, ties round
     up). "Center column" always means the _box's_ own rendered center
     (`box.x + Math.floor(box.width / 2)`), never the reach-padded slot's
     center (see point 4). One member + one qualifying parent is the
     single-parent case (#971, the #964 repro exactly). One member + more
     than one qualifying parent is the converging case (#972,
     mean-of-parents). More than one member (siblings sharing one
     qualifying-parent-set) spreads evenly by centering the block's _total
     width_ on the shared desired center, then laying members out
     left-to-right inside the block. Desired center → desired left edge is
     `desiredCenter - Math.floor(totalWidth / 2)` (floor chosen only for
     determinism; ceil is equally acceptable if applied consistently).
   - Blocks are then compacted left-to-right, one pass, in declaration
     order: each block's actual left edge is
     `max(desiredLeft, previousBlockRightEdge + hGap, 0)` — a block only
     ever gets pushed right of its desired position, never left, and
     blocks are never reordered. **This compaction pass is universal, not
     specific to multi-parent blocks**: two _different_ single-parent
     blocks can still have colliding desired positions, so #971 must
     implement this compaction step itself (see "Staging" below).

4. `columnReach` (per-relationship label/fan-out slot padding,
   [lines 499-553](https://github.com/dfadler/zombie-mermaid/blob/main/packages/ascii-renderer/src/class-diagram.ts#L499-L553))
   is unaffected in kind, but #971/#972 must not conflate two different
   uses of slot geometry: **slot width** (`leftPad + w + rightPad`) is what
   block-width and compaction _spacing_ arithmetic uses; a block's or
   parent's **center column**, used as an alignment _target_, is always
   the unpadded _box_ center. Aligning to the padded slot's center instead
   would visually misalign boxes whenever `leftPad != rightPad`.

## Existing defenses: unaffected, still required

Both mechanisms read final `placed` positions at render time and have no
dependency on how those positions were derived — **no code changes needed
from #971/#972** (full walkthrough in the linked comment):

- **Same-level cycle detour** (`obstructionBottom`, issue #953 / PR #957).
- **Cross-level box-occupancy guard** (`boxCells`/`setCGuarded`, PR #963,
  commit `a1074a5`) — better x-assignment should make this guard fire
  _less often_ (shorter jogs), but it does **not** become unnecessary: the
  "target is above source" branch still has no collision-avoidance routing
  of its own, and this guard is its only protection.

## Staging: two implementation issues, with one correction to #964's original split

- **#971 (single-parent alignment + universal compaction)** implements the
  single-parent desired-center computation, the no-resolvable-parents
  fallback, and the compaction pass itself — applied across **all** blocks
  at a level, not just single-parent ones (multi-member/multi-parent blocks
  simply aren't computed yet, so they fall back to today's position and
  compact like any other block). This makes #971 a real, independently
  mergeable fix, not a fragment waiting on #972 to be safe to ship. (#964's
  original framing assumed #971 would have nothing to compact against —
  see the linked comment for why that's wrong.)
- **#972 (multi-parent / overlap resolution)** implements only the
  remaining desired-_position_ computations (multi-member and multi-parent
  blocks), reusing #971's compaction pass unchanged.

## Sample-catalog impact (verified, not assumed)

**4 of the 16 existing `classDiagram` samples in `samples-data.ts` shift at
least one class's column** under this method: Class: Realization (`..|>`),
Class: Relationship Labels, Class: Design Pattern — Observer, and Class:
MVC Architecture. The other 12 (including `Inheritance (<|--)` and
`Full Hierarchy`, whose specific box widths happen to make the block-centered
result numerically coincide with today's) show no change. **#973 needs to
regenerate and re-verify exactly these four ASCII baselines** — see the
linked comment for the full per-sample table, why each one shifts, and the
verification methodology. SVG baselines for the same samples are unaffected
(SVG's ELK/Brandes-Köpf path doesn't change).

## SVG: confirmed out of scope

SVG already runs full Brandes-Köpf via ELK, independent of anything in
`class-diagram.ts`. No SVG change is proposed or needed by this decision.

## Consequences

- #971 and #972 have a concrete algorithm to implement, not just an
  algorithm name to look up.
- #973's re-verification scope is bounded to the four samples identified
  above, rather than "possibly all 16" or "possibly none."
- The `obstructionBottom` same-level detour and the `boxCells`/`setCGuarded`
  cross-level guard need no code changes from #971/#972.
- The chosen method is intentionally weaker than full Brandes-Köpf for
  graphs with dense multi-level crossing structure; this repo's own sample
  catalog gives no evidence that gap matters today. If a future diagram
  shape exposes it, revisit with that concrete case in hand rather than
  speculatively upgrading now.
