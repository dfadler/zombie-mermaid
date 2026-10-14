# A built-in `layout: 'simple'` for flowcharts

Status: implemented

## Context

SVG output for flowchart, state, class, ER and architecture diagrams needs
`elkjs` (about 466 KB gzipped), which is an optional peer since
[#1370](https://github.com/dfadler/zombie-mermaid/issues/1370). Without it,
`renderMermaidSVG` throws `ElkNotRegisteredError`. A size-sensitive browser app
that only draws flowcharts has no lighter option.
[#1685](https://github.com/dfadler/zombie-mermaid/issues/1685) asks for a small
built-in layered layout and leaves four questions open: which diagram types
first, opt-in or fallback, how large a quality gap is acceptable, and the size
budget. mermaid.js 12 uses ELK by default, so ELK is the quality reference, and
the pinned mermaid 12.1.0 render (`pnpm run layout:oracle`) is the oracle.

## Decision

**Diagram types: flowchart only.** `graph` / `flowchart` first. State shares the
graph model but its ELK path leans on engine features a simple layout would
have to re-invent: a pinned first layer for `[*]`, `MODEL_ORDER` cycle breaking,
composite-state compounds and concurrency regions (`STATE_LAYOUT_OPTIONS`,
`STATE_MARKER_LAYER_CONSTRAINT` in `layout-engine/to-elk.ts`). Class (546 lines
in `class/layout.ts`) and ER have their own member-sized boxes and per-diagram
ELK options; architecture needs ports. None of that is needed to answer #1685's
"flowchart" use case, so state, class, ER and architecture ignore the option
and still need `elkjs`. One caveat: a state diagram and a flowchart are the same
parsed type, and the engine tells them apart only by a `[*]` marker
(`isStateGraph`), so a state diagram with no marker gets the simple layout.
Stated in `docs/api-reference.md`.

**Opt-in, not fallback.** `layout: 'simple'` on `renderMermaidSVG` (and
`layoutFlowchartSync`). The name follows the existing option style: one
lower-case word naming an engine, typed `'elk' | 'simple'` as `LayoutEngine` in
`@zombie-mermaid/core` beside `layoutCache`, `direction` and `curve`. Unset or
`'elk'` keeps every existing byte of output (checked by a test that renders
both and compares strings). A silent fallback would make output depend on
whether `elkjs` happened to be installed, would change snapshots between
environments, and would hide the `ElkNotRegisteredError` that tells people what
to install. An unknown value throws.

**Acceptable quality gap and threshold.** The oracle scores relative placement
only (which node is above, beside or inside which), per sample, against mermaid
12.1.0. Measured on the 37 flowchart samples, both engines on the same commit:

| Engine | mean vertical | mean horizontal | mean containment | lowest single figure | samples with a figure under 90% |
| ------ | ------------- | --------------- | ---------------- | -------------------- | ------------------------------- |
| ELK    | 98%           | 95%             | 100%             | 20%                  | 5                               |
| simple | 97%           | 96%             | 100%             | 18%                  | 5                               |

Per sample, the simple layout is better than ELK on 5 (Nested Subgraphs, CI/CD
Pipeline, System Architecture, CJK Labels, Git Branching Workflow), worse on 3
(Labeled Fan-In LR, vertical 100% to 50%; Nested Subgraphs RL, vertical 100% to
67%; Edges Into and Out of Subgraphs, horizontal 100% to 18%) and equal on the
other 29; the full table is in the implementing PR. The reason it scores so close is that it copies mermaid's own tie-breaks where
ELK deviates: node order is first mention, cycles break on the depth-first back
edge, sibling subgraphs are not reversed.

Threshold, to hold the layout to: **mean vertical at least 95%, mean horizontal
at least 93%, mean containment at least 98%** over the flowchart samples, i.e.
no more than 3 points under ELK's mean on any figure, and no sample's lowest
figure below the 18% it scores today (a ratchet, not a target). The oracle needs
Chromium so it cannot run in CI; CI instead enforces structural invariants on
every flowchart sample under `layout: 'simple'` (no overlapping nodes, nodes
inside canvas, edge ends on their nodes, finite geometry). The oracle does not
see edge routing at all, and that is where the layout is plainer than ELK's:
edges are orthogonal polylines through per-rank slots, not ELK's routed ports,
and a back edge that crosses a subgraph can run over a node. That gap is
accepted and documented, not measured. SVG and ASCII snapshots are unaffected:
the default engine does not change, and no snapshot case uses the option.

**Algorithm** (`layout-engine/layered.ts`, plain Sugiyama in an abstract
axis/cross frame so one implementation serves TB, BT, LR and RL):

1. Cycle breaking: reuse `findBackEdges` (the depth-first reversal the ELK path
   already uses), so the same edge closes the same cycle in both engines.
   Self-loops are taken out first and drawn with the ELK path's own loop
   geometry (`synthesizeSelfLoopEdges`).
2. Ranking: longest path, in doubled ranks. Real nodes sit on even ranks; every
   edge gets a dummy on each rank it crosses, so even an edge between adjacent
   nodes owns a slot on an odd rank. That slot carries the edge label (an
   odd rank without a label has height 0, so unlabeled graphs space ranks by
   `layerSpacing` exactly) and keeps parallel edges apart.
3. Crossing reduction: initial order by depth-first walk (as dagre does), then
   up to 8 alternating barycenter sweeps, keeping the order with the fewest
   crossings. On 1500 random 4-6 node DAGs this took total crossings from 560 to 314. Pairwise counting is O(E^2) per rank pair; a binary-indexed tree is the
   upgrade if large graphs need it.
4. Coordinates: each slot is pulled toward the mean of its neighbours' cross
   positions in 4 down/up passes, and neighbours keep their minimum gap by
   projecting onto the nearest non-decreasing sequence (pool adjacent
   violators, the exact least-squares answer).
5. Components are laid out one at a time and packed along the cross axis in
   source order; rank positions are shared so same-rank nodes stay level.
6. Edge points: orthogonal, through each dummy centre, with the bend halfway
   between ranks; then the existing `straightenTinyJogs` and shape clipping.

**Subgraphs: nested boxes, laid out inside-out.** Each subgraph is its own
layered layout, becomes one opaque box in its parent's, with the same padding
as the ELK path (`SUBGRAPH_PADDING`, 44 px under the title) mapped into the
abstract frame so the title stays on top in BT and RL. An edge is routed at the
level of the lowest common ancestor of its endpoints and then joined to the real
nodes, so it crosses the boundary without ports. An edge to or from a subgraph
id lands on the box. A subgraph's own `direction` is ignored (it follows its
parent); mermaid 12 mostly does the same
([known-differences.md](../known-differences.md#subgraph-inner-direction)). The
option does not reject it, because the diagram still draws sensibly.

**Also ignored under `'simple'`:** `mergeEdges` (no trunks), `layoutCache`
(layout is cheap and not ELK).

**Size.** Browser bundle, esbuild minified, gzip (the method in
`scripts/check-bundle-size.ts`, `consumerBundles`), measured with the new files
stubbed out for the "before":

| Bundle                         | without simple | with simple | with elkjs registered |
| ------------------------------ | -------------- | ----------- | --------------------- |
| `@zombie-mermaid/svg-renderer` | 78.9 KB        | 82.3 KB     | 516.6 KB              |
| `zombie-mermaid` (SVG + ASCII) | 137.2 KB       | 140.6 KB    | 577.7 KB              |

The cost is 3.5 KB gzipped either way, about 0.7% of the elkjs bundle it
replaces. The implementation is 460 + 363 lines in two new files and three
exports added to `to-elk.ts` / `from-elk.ts`. Budgets in
`scripts/bundle-size-budget.json` hold except `unpackedBudgets` for
`packages/svg-renderer/dist`, raised from 414000 to 432000 bytes for the two new
modules plus their declarations.

## Consequences

- Rules out an automatic fallback and a state/class/ER simple layout for now.
  Extending to state would be a separate decision: it needs the start marker
  pinned to rank 0, composite states, and regions.
- Adds a second layout code path that must keep pace with node-shape and
  subgraph changes. The per-sample invariants test and the oracle option
  (`--layout=simple`) are the guard.
- Trade-off accepted: edge routing is plainer than ELK's. Placement agreement
  with mermaid is a point under or over ELK's depending on the figure.
- Self-review against
  [the decision-doc checklist](decision-doc-self-review-checklist-977.md):
  empty graph and single node return zero-size and node-size layouts (tested);
  cycles reverse the depth-first back edge and still draw source to target;
  self-loops are excluded from ranking and reserve cross-axis room only in TB
  and BT, because in LR and RL the loop bulges into the rank gap; a subgraph
  with no members gets a box sized by its title; the asymmetric case is the
  44 px title padding against 16 px elsewhere, mapped per direction, and the
  flipped (BT, RL) case is tested; ranks are doubled, so "rank distance" in this
  doc always counts half-ranks and only even ranks hold real nodes; the cited
  precedent (`findBackEdges`, `SUBGRAPH_PADDING`, `synthesizeSelfLoopEdges`,
  `isStateGraph`) was opened and does what is claimed; this doc makes no claim
  about an unimplemented sub-issue.
