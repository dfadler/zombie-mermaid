# ASCII class-diagram x-coordinate assignment (#970): a block-based priority method, not full Brandes-Köpf

Written for [#970](https://github.com/dfadler/zombie-mermaid/issues/970),
staged from [#964](https://github.com/dfadler/zombie-mermaid/issues/964).
This is the design/decision stage only — no changes to
`packages/ascii-renderer/src/class-diagram.ts` accompany this doc. Single-parent
alignment ([#971](https://github.com/dfadler/zombie-mermaid/issues/971)) and
multi-parent/overlap resolution
([#972](https://github.com/dfadler/zombie-mermaid/issues/972)) implement the
algorithm below; baseline re-verification
([#973](https://github.com/dfadler/zombie-mermaid/issues/973)) re-renders the
samples this doc identifies as changing (see "Sample-catalog impact" below).

## Context

`class-diagram.ts` lays out classes level-by-level (`levelGroups`,
[lines 374-377](https://github.com/dfadler/zombie-mermaid/blob/main/packages/ascii-renderer/src/class-diagram.ts#L374-L377)
on current `main`) and then packs each level's classes strictly left-to-right
in source-declaration order (the positioning loop,
[lines 562-596](https://github.com/dfadler/zombie-mermaid/blob/main/packages/ascii-renderer/src/class-diagram.ts#L562-L596)):
`currentX += slotWidth + hGap`, with no reference to any parent's column.
When a level has exactly one occupant, that occupant always lands at column 0
— even when its real parent sits far to the right at the level above — and
the relationship line has to jog the full width of the canvas to reach it.

#964's scoping pass confirmed the SVG renderer does **not** have this bug:
its ELK-based layout runs Brandes-Köpf horizontal coordinate assignment
(`elk.layered.nodePlacement.bk.fixedAlignment: 'BALANCED'`,
`packages/svg-renderer/src/layout-engine/to-elk.ts`), and #964's own
side-by-side render of the repro showed ELK centering the lone child exactly
under its parent while ASCII left it at column 0. It also prototyped a
barycenter _reorder_ pass and found it doesn't help: reordering only changes
relative order among siblings at the same level, and does nothing when a
level has exactly one occupant — the repro case has nothing to reorder
against. A real fix needs actual x-coordinate _assignment_, not reordering.

## Decision

**Adopt a block-based "priority method" — a simplified, integer-cell
predecessor of Brandes-Köpf, not the full algorithm.** Concretely:

1. Keep the existing level assignment (`level`/`levelGroups`) and
   declaration-order-based sibling ordering exactly as they are today. #964
   already showed reordering doesn't fix anything here, and this repo's own
   sample catalog gives no evidence that crossing minimization is a real
   problem worth solving — every existing `classDiagram` sample (see
   "Sample-catalog impact" below) renders correctly-ordered siblings today.
   Changing _order_ is out of scope; only _position_ changes.

2. Within a level, group classes into **alignment blocks**: classes that
   share the _exact same parent-id set_ form one block, processed as a unit.
   This grouping is the load-bearing part of the design — see "Why blocks,
   not per-node medians" below for why evaluating each child independently
   against its parent's center silently degrades back to today's plain
   left-packing in the most common multi-child case.

3. For each level, in the level's existing declaration order:
   - A block with no parents (a root, or a class this diagram never
     connects) keeps exactly the x-position the _current_ left-to-right
     packing would give it. There is nothing to align it to, and every
     level-0 class is in this state.
   - A block with parents computes its **desired center** as the mean of
     its distinct parents' center columns (already resolved, since levels
     are processed top-down), rounded to the nearest integer cell
     (`Math.round`; ties round up, matching JS's existing rounding
     convention used elsewhere in this file, e.g. `relColumnOffset`'s
     `Math.round((pos - (n - 1) / 2) * step)`). A block with one member and
     one parent is the single-parent case (#971): its desired center _is_
     the parent's center, so the lone child aligns exactly under it — this
     is the #964 repro, fixed exactly as stated. A block with one member
     and more than one parent is the converging case (#972): mean-of-parents
     is the "reasonable compromise" #964's own suggested scope named. A
     block with more than one member (several children sharing one parent)
     spreads those children evenly by centering the _whole block's total
     width_ (sum of member widths + gaps between them) on the shared
     parent's center, then laying members out left-to-right inside the
     block at their normal spacing — this is what actually implements
     "multiple children of the same parent spread evenly around that
     parent's center."
   - Blocks are then compacted left-to-right, one pass, in the level's
     existing declaration order: each block's actual left edge is
     `max(desiredLeft, previousBlockRightEdge + hGap, 0)`. A block can only
     be pushed right of its desired position, never left, and blocks are
     never reordered relative to each other. This is the overlap-resolution
     step (#972's other half): when two blocks' desired positions would
     collide, the later one (in declaration order) yields, exactly the way
     Gansner/Sugiyama-style "priority" compaction resolves conflicts, and
     exactly how today's code already resolves the (currently trivial,
     always-satisfied) case of one level-0 root with no other blocks to
     collide with.

4. `columnReach` (the per-relationship label/fan-out padding reservation,
   [lines 499-553](https://github.com/dfadler/zombie-mermaid/blob/main/packages/ascii-renderer/src/class-diagram.ts#L499-L553))
   is unaffected in kind: it still runs _before_ x-assignment, still
   widening each class's _slot_ (not its box) by however much a label or
   fan-out overhangs the box edges. The only change x-assignment makes here
   is that "slot width" (already `leftPad + w + rightPad`, current code
   [line 589](https://github.com/dfadler/zombie-mermaid/blob/main/packages/ascii-renderer/src/class-diagram.ts#L589))
   is what block-width and block-compaction arithmetic above must use in
   place of raw box width `w` — reach-padding and parent-alignment compose
   by having the alignment pass consume the already-reach-padded slot
   widths, not by either pass needing to know about the other's internals.

### Why a block-based priority method, not full Brandes-Köpf

Brandes-Köpf produces its result by running the alignment step **four
times** (once per corner: upper-left, upper-right, lower-left, lower-right),
each pass doing real-valued median alignment along "vertical alignment
classes" with block-based compaction, then **averaging** the four resulting
coordinate arrays into one "balanced" result (this is exactly what ELK's
`fixedAlignment: 'BALANCED'` mode the SVG renderer already uses does). Two
things about that don't map cleanly onto this file's actual constraints:

- **Character-cell granularity turns "average four real-valued layouts"
  into a correctness hazard, not just a rounding nuisance.** Each of the
  four individual alignments is independently guaranteed collision-free by
  construction (that's what its own compaction step ensures). The
  _average_ of four collision-free layouts has no such guarantee — nothing
  in the algorithm proves the mean of four non-overlapping arrangements is
  itself non-overlapping. In a continuous SVG/pixel space this shows up as
  sub-pixel jitter that's visually irrelevant. In a discrete character grid
  where every column is either free or occupied, closing that gap means
  adding an explicit box-collision/overlap-repair pass _after_ the average
  — exactly the kind of "adapting Brandes-Köpf means adding overlap
  handling it doesn't natively have for variable-width nodes" caveat #970's
  own issue body flagged in advance. At that point the extra three
  alignment passes and the averaging step are pure overhead: this file
  needs the same overlap-repair logic regardless, and a single well-chosen
  alignment (see next point) needs no averaging to reach a good result.
- **This repo's diagrams don't have the shape Brandes-Köpf's four-corner
  averaging exists to fix.** The four-direction combination exists to
  balance competing alignment preferences when a graph has long edges
  spanning several levels, dense crossing structure, or nodes with several
  same-level neighbors pulling a layout toward different corners. This
  repo's `class-diagram.ts` diagrams are shallow (verified below: every
  existing sample's parent/child relationships span exactly one level; see
  "Sample-catalog impact"), and the parent-averaging block method above
  already produces the exact centered result Brandes-Köpf's balanced mode
  would for a single-parent or symmetric-multi-parent case — the cases
  this renderer's diagrams actually contain. There's no evidence in this
  repo's own catalog that the extra machinery buys a better layout for the
  diagrams it actually needs to render.
- **A single-pass, order-preserving compaction sweep is what already
  composes safely with this file's Manhattan routing**, which is the
  concern #970's issue body raised explicitly. `findClearColumn`,
  `connectionColumns`, and `anchorOffset` all read final, already-resolved
  `PlacedClass.x` values — they have no dependency on _how_ those values
  were derived, only that they're final, integer, and collision-free by the
  time routing runs. A single deterministic top-down block-compaction pass
  guarantees exactly that (each level's positions are fully resolved before
  the next level reads them as parent centers) with a straightforward
  correctness argument (declaration order + monotonic non-decreasing
  left-to-right assignment = no two same-level boxes overlap by
  construction). A four-pass-plus-average scheme would need that same
  guarantee re-established through a repair pass anyway, for no benefit
  routing could use.

The trade-off being made explicitly: this heuristic will not always produce
the same result Brandes-Köpf/ELK would for a genuinely complex graph (dense
crossings, deep multi-parent chains). Given the sample-catalog evidence
below that this renderer's actual diagrams are shallow and don't exercise
that complexity, and that #964 already found reordering (BK's other major
ingredient) is a no-op on this catalog, that gap is accepted rather than
paid for with BK's full complexity and its cell-grid-specific overlap
hazard.

### Why blocks, not per-node medians

An earlier draft of this design evaluated each child's desired position
independently against its parent's center, then compacted left-to-right.
Simulating it against this repo's actual `Inheritance (<|--)` sample
(`Animal <|-- Dog`, `Animal <|-- Cat`) exposed the failure mode: `Dog`'s
independently-computed desired position lands under `Animal`'s center
correctly, but `Cat` (evaluated next, against the same parent center, with
no awareness that `Dog` already claimed that spot) gets immediately pushed
right by the "don't overlap the previous sibling" rule to the same slot it
would have occupied under today's _unmodified_ left-to-right packing — i.e.
the per-node version silently degrades back to today's behavior for the
single-parent, multiple-children case, exactly the case #964's own suggested
scope calls out as needing "spread evenly around center." Grouping same-
parent-set siblings into one block and centering the _block's total width_
(not each member individually) on the parent's center is what actually
achieves that spread; verified by re-running the same simulation with
block-based grouping and confirming `Dog`/`Cat` end up symmetric around
`Animal`'s center instead of collapsing back to `x=0`/`x=24` (their current,
unchanged positions — see the `Inheritance` and `Full Hierarchy` rows in
"Sample-catalog impact" below, where the specific box widths involved happen
to make the block-centered result coincide with the old one anyway).

## Existing same-level and cross-level defenses: unaffected, still required

Read in full for this decision (current `main`,
`packages/ascii-renderer/src/class-diagram.ts`):

- **Same-level cycle detour (issue #953 / PR #957).** The `else` branch
  handling two same-level classes (lines ~1234-1266 on current `main`)
  computes its detour row by scanning `placed` at render time for _any_
  other same-row class whose box overlaps the `[min(fromCX,toCX),
max(fromCX,toCX)]` horizontal span, and routes below the tallest such
  obstruction (`obstructionBottom`). This is a live re-scan of final
  positions — it has no dependency on _how_ those positions were computed,
  only that `placed` holds the real final coordinates by the time
  relationship-drawing runs. **No change needed.** Better x-assignment
  changes _which_ boxes end up in a same-row span and _how wide_ that span
  is, but the obstruction search itself already handles whatever layout it's
  handed; it was written generically (as its own comment notes, generalizing
  er-diagram.ts's `obstructionBottom` search) rather than assuming
  left-to-right declaration-order positions.
- **Cross-level box-occupancy guard (`boxCells`/`setCGuarded`, PR #963,
  commit `a1074a5`).** Taken as a snapshot of every occupied cell right
  after boxes are drawn ([lines 669-706](https://github.com/dfadler/zombie-mermaid/blob/main/packages/ascii-renderer/src/class-diagram.ts#L669-L706)
  on current `main`), then consulted by every write in the cross-level
  ("target below"/"target above") relationship branches so a mis-routed
  jog degrades to a gap instead of corrupting a box's text. Like the
  same-level detour above, this guard reads `placed` positions at render
  time and makes no assumption about how they were derived — **no change
  needed** here either. Two things are worth being explicit about instead
  of assuming this guard becomes redundant:
  - Better x-assignment should make the guard fire _less often in
    practice_ — its entire reason for existing is exactly the long,
    parent-blind jog #964 reports, and a child that lands under (or near)
    its real parent needs a much shorter, or no, horizontal run to reach
    it. Fewer long jogs means fewer chances to cross an unrelated box.
  - It does **not** become unnecessary. The commit's own comment on the
    "target is above source" branch says outright: "This branch has no
    collision-avoidance routing at all... The boxCells guard is this
    path's only protection against a horizontal run landing on an
    unrelated box." That branch gets no new obstruction-avoidance logic
    from this design — the block-compaction method reduces how far apart
    misaligned parent/child columns can drift, it doesn't add routing
    intelligence to the branch that has none. The guard stays the only
    backstop for it. Likewise, the "target below source" branch's
    `findClearColumn` call only verifies a single _column_ is clear over a
    y-range — it was never a guarantee about the horizontal run at `midY`
    reaching all the way from `fromCX` to `toCX`, which is exactly why the
    guard was added there too (see the inline comment at
    [lines 1108-1119](https://github.com/dfadler/zombie-mermaid/blob/main/packages/ascii-renderer/src/class-diagram.ts#L1108-L1119)
    on current `main`). Multi-parent overlap resolution (#972) in
    particular can still produce a compacted-but-imperfect layout where a
    skip-level relationship's horizontal run crosses an intervening
    same-level box; the guard is exactly the mechanism that keeps that safe
    while #972's overlap heuristic is still new and unproven against real
    diagrams.

Net effect on #971/#972's implementation: neither issue needs to touch
`obstructionBottom`, `boxCells`, or `setCGuarded`. Both mechanisms are
already position-derived, generic, and orthogonal to the x-assignment
algorithm producing those positions.

## Staging: two implementation issues, as already scoped

The two-stage split #964 already proposed maps directly onto the block
method above, with no changes needed to that boundary:

- **#971 (single-parent alignment)** implements step 3's single-member,
  single-parent case: a block of one class with exactly one parent aligns
  its center under that parent's center. This is the #964 repro exactly,
  and requires no block-compaction conflict handling beyond what already
  exists (a lone block with no other same-level block competing for space,
  which is every case #971 covers by definition — a class alone in its
  parent-set group).
- **#972 (multi-parent / overlap resolution)** implements the remaining
  cases: multi-member blocks (children sharing one parent, spread across
  the block's width), multi-parent blocks (mean-of-parents), and the
  block-compaction conflict rule (`max(desiredLeft, prevRight + hGap, 0)`)
  for when two blocks' desired positions collide. #971 should land first
  since #972's compaction logic subsumes and must not regress it — the
  single-block case is a degenerate instance of the same block algorithm
  with nothing to compact against.

## Sample-catalog impact (verified, not assumed)

#964's scoping pass diffed all 16 `classDiagram` entries in `samples-data.ts`
under a **reorder-only** prototype and found zero changes — but reordering
can't change a lone occupant's position, which is exactly the repro case.
That result does not carry over to real x-coordinate _assignment_, which
this design is. To check directly, I wrote a throwaway simulation (not
committed — read-only analysis against `parseClassDiagram` +
`measureMultiBox`, both already exported from `@zombie-mermaid/mermaid-parser`
and `draw.ts`) that reimplements this file's level-assignment/packing logic
for the "old" position of every class in every `classDiagram` sample, and
the block-based method above for the "new" position, using the real default
horizontal gap (`paddingOffset(5, 5, 4, 1) = 4`) and real box widths from
`measureMultiBox`. Result: **4 of the 16 existing `classDiagram` samples
would shift at least one class's column**:

| Sample                           | What moves                                                   | Why                                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Class: Realization (`..\|>`)     | `Flyable` (lone child of `Bird`): x=0 → x=1                  | The #964 repro pattern exactly — a level with one occupant, previously always left-aligned regardless of its parent's column.                   |
| Class: Relationship Labels       | `Course` (child of both `Teacher` and `Student`): x=0 → x=11 | Multi-parent convergence — `Course` now centers on the mean of `Teacher`'s and `Student`'s centers instead of sitting at the level's left edge. |
| Class: Design Pattern — Observer | `Observer` (child of `EventEmitter`): x=0 → x=5              | Single-parent alignment, one level deep into the diagram (`Subject → EventEmitter → Observer → {Logger, Alerter}`).                             |
| Class: MVC Architecture          | `View` (child of both `Controller` and `Model`): x=0 → x=5   | Multi-parent convergence, same mechanism as Relationship Labels.                                                                                |

The other 12 samples (the 5 single-class annotation samples, `All 6
Relationship Types`, the four simple one-parent/one-child relationship-type
demos, `Inheritance (<|--)`, and `Full Hierarchy`) show **no** column change
under this method. The single-class samples trivially have nothing to
align. `Inheritance (<|--)` and `Full Hierarchy` both have multi-child
blocks (`{Dog, Cat}` under `Animal`; `{Dog, Cat}` under `Mammal`, `Parrot`
under `Bird`) where this specific catalog's actual box widths happen to make
the block-centered result numerically coincide with today's left-packed
result — not a property of the algorithm, just this catalog's specific
content. This is a materially different conclusion from #964's "existing
catalog doesn't exercise this pattern": it does, in a quarter of the
category's samples, once real x-coordinate assignment (not reordering) is
what's being tested. **#973 needs to regenerate and re-verify all four ASCII
baselines named above** (SVG baselines for the same samples are unaffected —
SVG's ELK/Brandes-Köpf path doesn't change).

(Simulation caveat: the script approximates `columnReach`'s label-driven
slot widening as zero, since none of the four affected samples' relationship
labels are wide enough to overhang their box edges — `Relationship Labels`
is the one sample here with labels at all, and its shift is driven by
multi-parent centering, not reach padding. This does not affect the
column-reach interaction described in the Decision section above, which
`#971`/`#972` must still implement against the real, reach-padded slot
widths.)

## SVG: confirmed out of scope

#964's side-by-side render (ELK's `BALANCED` Brandes-Köpf already centering
the lone `Kid` under `RightSrc`) and this decision's own reasoning above
(SVG already runs full Brandes-Köpf via ELK, independent of anything in
`class-diagram.ts`) both point the same way. No SVG change is proposed or
needed by this decision.

## Consequences

- #971 and #972 have a concrete algorithm to implement (block grouping by
  parent-set, mean-of-parent-centers desired position, single left-to-right
  compaction pass), not just an algorithm name to look up.
- #973's re-verification scope is now bounded to the four samples identified
  above, rather than "possibly all 16" or "possibly none."
- The `obstructionBottom` same-level detour and the `boxCells`/`setCGuarded`
  cross-level guard need no code changes from #971/#972 — both were already
  written generically against final placed positions.
- The chosen method is intentionally weaker than full Brandes-Köpf for
  graphs with dense multi-level crossing structure; this repo's own sample
  catalog gives no evidence that gap matters today. If a future diagram
  shape exposes it (e.g. a genuinely deep, densely-connected class
  hierarchy), revisit with that concrete case in hand rather than
  speculatively upgrading now.
