# Recommendation: cluster-boundary edge-exit anchoring (#1135) — which plan to pursue

Status: **recommendation, not yet a decision.** Written for
[#1135](https://github.com/dfadler/zombie-mermaid/issues/1135) and
[docs/decisions/cluster-exit-anchoring-scoping-1135.md](cluster-exit-anchoring-scoping-1135.md)
(PR [#1144](https://github.com/dfadler/zombie-mermaid/pull/1144)), reviewing
the three candidate implementation plans filed as
[#1148](https://github.com/dfadler/zombie-mermaid/issues/1148) (Option 1,
full compound-node modeling),
[#1149](https://github.com/dfadler/zombie-mermaid/issues/1149) (Option 2,
targeted `EdgeBundle` reuse), and
[#1150](https://github.com/dfadler/zombie-mermaid/issues/1150) (Option 3,
post-process path-splicing). Every claim below was checked directly against
`packages/ascii-renderer/src/**` on `main` (worktree at this doc's commit),
not taken from the issues' own assertions — findings that confirm, correct,
or add to each plan's own text are called out explicitly.

## TL;DR

- **Pursue Option 1 (#1148), but not exactly as scoped.** It's the only
  option that produces genuinely correct output (independent per-edge
  boundary exit points, matching real mermaid's compound-node clipping), and
  its "Large" effort estimate is realistic — if anything, slightly low. Two
  concrete amendments are needed before implementation starts (below).
- **Drop Option 3 (#1150).** Its own planning pass already reached the right
  conclusion — I verified every one of its "ground truth found while
  planning" claims and they hold up. Nothing here changes that verdict.
- **Option 2 (#1149) is not a safe fallback for this specific bug.** Its
  central premise — that `draw-bundles.ts` already solves "multiple lines
  converging on one cell" — is only true for line/corner glyphs. I read
  `draw-bundles.ts` end to end: bundled-edge label rendering is not
  "unverified," it does not exist. There is no code path anywhere in
  bundle drawing that calls the label-placement logic (`applyLabelLine`)
  ordinary edges use. Since #1135's actual repro (`done`/`fail` labels on a
  composite state's transitions) is exactly the labeled case, Option 2's own
  risk assessment undersells how serious this is — it reads as "might not
  render cleanly," when the accurate framing is "the machinery this plan
  wants to reuse was never built to draw a label at all."
- **A gap neither issue flags: Option 1 doesn't get label placement for
  free either.** `pathfinder.ts`'s `routeEdge` — the function Option 1's
  plan says it reuses — returns a bare `GridCoord[]`, nothing about where a
  label goes. Label placement (`applyLabelLine`) lives one layer up, in
  `edge-routing.ts`, entangled with lane assignment and direction-pair
  logic that Option 1's `cluster-boundary.ts` doesn't mention touching.
  This needs to be added to Option 1's scope and effort estimate before
  implementation starts, not discovered mid-PR.

## Ground-truth findings

Organized by which plan(s) each finding bears on.

### Blast radius: flowchart + state only (confirms Option 1's correction, refutes the scoping doc)

The scoping doc claims this is shared by "class-with-namespaces, composite
ER where applicable." That's wrong. `class-diagram.ts` and `er-diagram.ts`
import nothing from `converter.ts` or `grid.ts` — they have entirely
separate import graphs (own drawing/measuring helpers, `territory.ts` for
class only, no `convertToAsciiGraph`/`createMapping` anywhere). `registry.ts`
dispatches exactly five ASCII renderers (`xychart`, `er`, `sequence`,
`class`, `flowchart`) — there is no `state` entry. State diagrams reach the
shared pipeline because `flowchart.ts`'s own header comment says so
outright: it "renders flowcharts... and state diagrams (stateDiagram-v2)...
via the shared grid-based layout + A* pathfinding pipeline." Option 1's
grounding note is correct; the scoping doc's blast-radius claim (which all
three issues otherwise inherit uncritically) is not. This shrinks the actual
regression surface for whichever option ships.

### Subgraph border/label: not grid-occupancy-tracked (confirms Option 1 and Option 3, refutes the scoping doc's "wall cells with gaps" framing)

I read `draw-subgraphs.ts` (`drawSubgraphBox`, `drawSubgraphLabel`) in full.
Both functions operate purely on a drawing-space `Canvas` via `write()` —
neither calls anything in `grid-occupancy.ts` (`isOccupied`, `placeBlock`,
`isFree`). The A* occupancy grid (`Grid` class, `grid-occupancy.ts`) only
ever reserves 3×3 node blocks (`NODE_BLOCK_SIZE`). Subgraph borders and
labels are drawn later, directly onto the canvas, with zero interaction with
the structure the pathfinder consults. Option 1's grounding note and Option
3's "ground truth" section both independently reach this same correct
conclusion — worth noting since it means the finding is now confirmed by
three independent readings (Option 1's, Option 3's, and mine), not just
asserted once.

### `EdgeBundle`/`draw-bundles.ts`: solves glyph composition, not labels (materially weakens Option 2)

`edge-bundling.ts`'s `canBundle` explicitly rejects any edge with a label
(`if (edge.text.length > 0) return false`), with the comment "labels would
overlap at the junction." That's a real design constraint the existing
feature was built around, not an incidental gate. I then read
`draw-bundles.ts` end to end to check what happens if a labeled edge *were*
bundled. The trunk-drawing function's own comment says: "Label canvas
(bundled edges typically don't have labels, but handle it)" — followed by
`const labelCanvas = copyCanvas(graph.canvas)`, i.e. an unmodified copy.
That is the entire "handling." Nothing in `draw-bundles.ts` calls
`applyLabelLine` or any equivalent; the label-placement logic that ordinary
edges use lives in `edge-routing.ts` and is never invoked for a bundle.
So "multiple lines converging on one cell need one correctly-composed
glyph, not whichever edge drew last" (Option 2's own framing) is true and
solved — for the *path/corner* glyphs. It is not true for labels: that
problem hasn't been solved, attempted, or partially built; it's absent.
Option 2's plan proposes feeding labeled edges (the actual #1135 shape)
through this machinery. Its own risk section calls the label question
"unverified and must be the first thing checked once implemented" — based
on this reading, it isn't a verification task, it's a build-a-new-feature
task, which changes the honest effort estimate for Option 2 non-trivially.

### The converter-level tag is genuinely necessary, not gold-plating (confirms all three plans converge correctly)

All three plans add a tag at the point `resolveSubgraphEndpoint` fires
(`AsciiEdge.clusterSource`/`clusterTarget`, or `.clusterBoundary`). I checked
whether this is avoidable — e.g., via the existing `getNodeSubgraph(graph,
node)` helper (`grid.ts`), already used by `edge-bundling.ts` to find which
subgraph a node belongs to. It can't be: `getNodeSubgraph` tells you a node
is a member of subgraph X, but not whether a *specific edge* into/out of
that node was originally addressed to the cluster id (`Processing --> Done`)
or was a genuine direct edge from that same member node
(`execute --> Done`) — after conversion both produce a structurally
identical `AsciiEdge` with `from = execute`. `resolveSubgraphEndpoint`
itself operates purely on the raw parsed `MermaidGraph`/`MermaidSubgraph`
(matching id strings), so the only point where "this edge was
cluster-addressed" is knowable is the instant `resolveSubgraphEndpoint`
resolves it — exactly what all three plans do. Option 3's "the ambiguity
*is* the root cause" framing is the correct diagnosis, and it applies
equally to Option 1 and Option 2, which already build the tag in from the
start rather than trying to avoid it.

### The subgraphs-before-edges reordering is safe (confirms Option 1 and Option 2)

Read `converter.ts`'s `convertToAsciiGraph` top to bottom: edges are built
first (lines ~88–128), subgraphs are converted after (lines ~130–134).
`resolveSubgraphEndpoint` and `subgraphDirectionIsHonored` — the only
functions that run during edge-building and touch subgraph data — both take
`MermaidSubgraph`/`MermaidGraph` (raw parser output), never `AsciiNode` or
`AsciiSubgraph`. Reordering so `AsciiSubgraph` objects exist before edges
are built doesn't change what either function sees or returns. Both plans'
claim that this is "a safe reordering" holds up under direct reading, not
just under the plans' own assertion.

### Grid-space vs. drawing-space subgraph bounding boxes are genuinely two different things today (sharpens a risk Option 1 already named, but understated)

`AsciiSubgraph.minX/minY/maxX/maxY` (the only bounding box that exists
today) is computed by `calculateSubgraphBoundingBox` (`grid.ts`) from
`node.drawingCoord`/`node.drawing` — drawing-space, not grid-space. Option
1's plan is correct that a new, separate grid-coordinate box is needed and
that this creates "two sources of truth that must stay consistent." What
the plan doesn't mention: the existing drawing-space box is not final the
moment `calculateSubgraphBoundingBox` returns — `ensureSubgraphSpacing`
(same file, runs afterward) further mutates `minX`/`maxX`/`minY`/`maxY` to
resolve overlaps between non-nested root subgraphs. A new grid-space box
"computed right after node placement" (the plan's own wording) needs to
either run after an equivalent grid-level adjustment (if the grid layout
pass has one) or be demonstrably immune to the scenario `ensureSubgraphSpacing`
exists to fix — otherwise the two boxes can disagree in exactly the
multi-subgraph layouts most likely to also have multi-exit clusters. This
should be checked explicitly, not folded into the plan's generic "derive
both from one shared traversal helper" mitigation, since that mitigation as
worded doesn't obviously cover a *timing* mismatch (one box adjusted post
hoc, one not).

### `territory.ts` is a real, available, but unwired tool (relevant to both surviving options' "v1 limitation" open questions)

`territory.ts`'s `allocateTerritory` (1-D interval scheduling, splits
contested space by geometry, not draw order) is imported only by
`class-diagram.ts` today — nothing in the flowchart/state grid pipeline
uses it. Both Option 1 (open question 5) and Option 2 (open question 1)
raise "single point vs. per-edge offset" as an open question and note a
`territory.ts`-based refinement as a possible future step. Confirmed: the
tool already exists, is already proven in production for a comparable 1-D
placement problem, and is not currently entangled with anything in
`grid.ts`/`pathfinder.ts` — so adopting it now, rather than deferring it, is
a smaller lift than either plan's phrasing ("a later refinement," "needs a
territory.ts-based refinement") implies. Worth reconsidering as v1 scope
rather than a follow-up, at least for Option 1 where per-edge independent
exit points are already the design (territory.ts would only add
collision-avoidance between those points, not change the design's shape).

### Grid coordinates are quantized; Option 3's core objection is real (confirms Option 3, informs any future drawing-layer work)

`gridToDrawingCoord` (`grid.ts`) maps a discrete grid cell to a drawing
coordinate by summing column widths/row heights up to that column/row, then
adding half the target cell's own width/height. This is a many-to-one,
quantized mapping — grid coordinates only ever land on specific column/row
boundaries or cell centers, never on an arbitrary computed point like "the
centroid between a cluster's targets." Option 3's claim that "there is no
grid coordinate whose converted position lands exactly on the computed wall
point" is correct, and its conclusion (pixel-exact alignment requires a
real drawing-layer override, contradicting the "no pathfinding/drawing
changes" framing) follows directly from this.

### `pathCells()` already exists, lowering (not eliminating) one of Option 3's costs

`grid-occupancy.ts` already exports `pathCells(path)`, which walks a routed
path (including `determinePath`'s non-axis-aligned Case-4 fallback) and
returns every cell it touches, specifically built for exactly this kind of
"does this path collide with that one" check. So Option 3's "collisions
with other edges' already-computed paths... would require a full re-scan of
every edge's path to build ad hoc occupancy" is accurate about needing the
re-scan, but the primitive it would re-scan *with* already exists and is
tested — this is a real but bounded cost, as the plan itself says, not a
from-scratch build. This doesn't change Option 3's bottom line: the other
two collision sources it identifies (subgraph walls, labels) have no
equivalent existing primitive at all, confirmed above, and those are the
ones that make silent-corruption risk unacceptable.

### The N=1 regression guard is structurally sound for all three plans (confirms the "byte-identical" claim, doesn't discriminate between options)

No test in the repo greps for `resolveSubgraphEndpoint` by name (checked
directly), and the "Composite States" sample (referenced in `grid.ts`,
`packages/site/samples-data.ts`, and
`ascii-canvas-size-offset-1093.test.ts`) is the only located sample matching
this shape. All three plans gate their new code path on "2+ qualifying
edges for this (cluster, direction) pair," with a singleton falling through
to the existing, unmodified code path. Given no other existing sample
appears to have 2+ exits/entries from/to one subgraph, this guard is a
real, working regression backstop for whichever plan is chosen — this
finding doesn't favor one option over another, it just confirms the
"single-exit stays pixel/byte-identical" claim all three plans make isn't
wishful thinking, contingent on the guard being implemented as described.

## Assessment of each option

### Option 3 — drop it

Its own planning pass already concluded the "cheap because no pathfinding
logic changes" premise doesn't survive contact with the actual codebase,
and every one of its cited "ground truth" claims checked out under my own
reading (quantization gap, no wall/label occupancy, tag-is-unavoidable
ambiguity). Its own effort estimate revision ("Medium, leaning Large,"
revised down from "Small") already erases its supposed cost advantage over
Option 1, while carrying a genuinely worse failure mode (silent visual
corruption on an undetected wall/label collision, vs. Option 1/2's
"visibly wrong until fixed" failure mode). There's no scenario in which
Option 3 is both cheaper and safer than the other two once its own
findings are taken seriously. Recommend closing it as "investigated, not
pursued," same disposition the scoping doc gave the original narrow
patch attempt.

### Option 2 — not right for this bug, keep the idea for a lower-stakes case

The reuse-`EdgeBundle` idea is genuinely clever and the plan's structural
claims about isolation (only `converter.ts`'s reordering touches anything
outside the new code) check out. But its viability for #1135 specifically
rests on labeled edges rendering acceptably through a shared-junction shape,
and I found the infrastructure for that doesn't exist rather than being
untested. Its own plan already flags that if labels can't be placed
cleanly, "this option would need to fall back to unlabeled cluster-exits
only, which would leave state diagrams — the issue's own reported case —
largely unfixed." Given what I found in `draw-bundles.ts`, I'd treat that
fallback as close to certain rather than a risk to empirically check —
building real label support into the bundle-drawing path is itself
non-trivial new work (a `route.labelSegment`-equivalent, keyed to a
junction/fan-out shape `edge-routing.ts` was never designed to describe),
at which point Option 2 stops being meaningfully cheaper than Option 1
while still producing a "single shared point" visual that its own plan
admits is not what real mermaid does. Its lower cost is real only for the
unlabeled case, which isn't the case #1135 asks to fix. Worth keeping the
`EdgeBundle`-reuse idea in mind for a future unlabeled-only cluster-exit
issue, if one is ever filed separately, but not as the answer to #1135.

### Option 1 — the one to pursue, with two amendments

Highest fidelity (independent per-edge exit points on the cluster boundary,
matching real mermaid's compound-node clipping instead of approximating
it), correctly scoped as Large, and its regression story (N=1 guard,
verified no existing sample crosses that threshold) holds up. Two things
should be added to its scope before implementation starts:

1. **Label placement is not free from reusing `pathfinder.ts`'s
   `routeEdge`.** `routeEdge` returns a bare path; the label-line logic
   (`applyLabelLine`, `route.labelSegment`) lives in `edge-routing.ts`,
   coupled to lane assignment and direction-pair selection that the new
   `cluster-boundary.ts` module doesn't currently plan to touch. Add
   explicit label-placement design (and `edge-routing.ts` to "files
   touched") to the plan, and add a labeled-edge case to the primary repro
   test rather than treating label rendering as something that falls out
   of the geometry work automatically.
2. **The new grid-space subgraph bounding box must account for
   `ensureSubgraphSpacing`'s post-hoc adjustment of the existing
   drawing-space box**, not just be "derived from the same shared
   traversal helper." Either confirm no grid-level equivalent adjustment is
   needed (and say why), or compute the grid-space box at the point that
   mirrors where `ensureSubgraphSpacing` runs today, so the two boxes can't
   silently diverge on a multi-subgraph layout.

With those two additions, Option 1's own open questions can be answered
straightforwardly:

- **Q1 (N=1 guard):** Keep it. It's the cheapest, most legible way to get
  the regression guarantee, and the guard's premise (no existing sample
  crosses the threshold) is independently confirmed above.
- **Q2 (defer entry-side?):** Fine to defer to keep the first PR reviewable,
  especially once label placement is added to scope — no need to also grow
  the diff with fan-in symmetry in the same change.
- **Q3 (exit-point collision when two exits land at the same perimeter
  point):** Acceptable as a stated v1 limitation given no sample currently
  exercises 3+ exits, but consider wiring `territory.ts` in now rather than
  as a later refinement (see finding above) — the tool already exists and
  fits this exact 1-D allocation shape, so the marginal cost of doing it
  right the first time looks smaller than the plan's phrasing suggests.
- **Q4 (blast-radius confirmation):** Settled — confirmed directly above
  (class/ER diagrams don't touch this pipeline at all).
- **Q5 (independent per-edge exit sides vs. one shared point):** Independent
  sides — this is the whole reason to prefer Option 1 over Option 2 for
  this bug; a shared point is the compromise Option 2 already admits is
  visually wrong, and Option 1 exists specifically to avoid inheriting it.

## Self-review checklist walkthrough

Per
[`decision-doc-self-review-checklist-977.md`](decision-doc-self-review-checklist-977.md):

- **Degenerate/edge-case inputs.** Checked: empty/degenerate cluster (all
  three plans exclude it upstream via `resolveSubgraphEndpoint`'s
  `memberIds.size === 0` guard, confirmed in `converter.ts`), the
  single-exit case (the N=1 guard, verified structurally sound above), and
  the maximally-asymmetric case (3+ exits fanning in genuinely different
  directions — the case Option 1's independent-exit design handles by
  construction and Option 2's shared-point design collapses). I did not
  independently trace a cycle/self-reference case since cluster-as-endpoint
  edges aren't a graph-cycle concern here (subgraphs form a tree via
  `parent`/`children`, not a general graph); flagged rather than silently
  assumed.
- **Boundary/off-by-one arithmetic.** This doc doesn't itself specify a new
  coordinate conversion or rounding rule (that's implementation work for
  whichever plan proceeds) — it does surface, as a finding rather than
  asserting past it, that `gridToDrawingCoord`'s quantization and
  `calculateSubgraphBoundingBox`'s asymmetric label-width widening
  (`floor`/`extra - extraLeft` split) are exactly the kind of rounding
  details a future grid-space-bbox implementation must get right by
  explicit choice, not by accident — called out above rather than left
  implicit.
- **Ambiguous terminology.** "Cluster boundary" / "exit anchor" are used
  consistently with the scoping doc's own usage throughout; I did not
  introduce a new term for an existing concept. Where this doc distinguishes
  "grid-space bounding box" from "drawing-space bounding box," that split is
  named explicitly (not left for context to disambiguate) because conflating
  them is precisely the risk being flagged.
- **Claims about a sub-issue's scope.** Every scope claim from the three
  issues that this doc relies on (blast radius, `canBundle`'s label
  exclusion, absence of wall/label occupancy, absence of a
  `resolveSubgraphEndpoint`-named test) was independently re-verified
  against the actual source in this pass, not restated from the issues'
  own text — see the "Ground-truth findings" section, which states for each
  item whether it confirms, corrects, or adds to the originating plan's
  claim.
- **Cited precedent.** `territory.ts`, `edge-bundling.ts`, `draw-bundles.ts`,
  `grid-occupancy.ts`, `converter.ts`'s `resolveSubgraphEndpoint`, and
  `grid.ts`'s `gridToDrawingCoord`/`calculateSubgraphBoundingBox`/
  `ensureSubgraphSpacing` were all opened and read directly for this doc
  (not recalled from the issues' paraphrases) — each citation above points
  at the specific behavior confirmed, not a remembered summary of what the
  file "probably does."

## Consequences

- Recommend closing #1150 (Option 3) as investigated-and-rejected, its own
  planning conclusion confirmed independently.
- Recommend #1149 (Option 2) stay open but be re-labeled as "not viable for
  #1135's labeled-edge case as scoped" rather than a live third option —
  the underlying `EdgeBundle`-reuse idea may still be worth keeping on file
  for a future unlabeled-only cluster-exit request.
- Recommend #1148 (Option 1) proceed to implementation only after its plan
  is revised to add explicit label-placement design and the grid-space/
  drawing-space bounding-box consistency question addressed above — as
  currently written, starting implementation would hit both gaps mid-PR
  rather than before it opens.
- This doc does not implement anything — no code under
  `packages/ascii-renderer/src/**` was changed to produce it, matching the
  scoping doc's own convention.
