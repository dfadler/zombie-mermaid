# Cluster-exit anchoring (#1148): label placement and bounding-box timing

## Context

[#1148](https://github.com/dfadler/zombie-mermaid/issues/1148) (compound-node
modeling for cluster-boundary edge exits) was approved with two prerequisite
design questions, from the review in
[cluster-exit-anchoring-recommendation-1135.md](cluster-exit-anchoring-recommendation-1135.md):
[#1164](https://github.com/dfadler/zombie-mermaid/issues/1164) (where labels
go for a cluster-boundary edge) and
[#1165](https://github.com/dfadler/zombie-mermaid/issues/1165) (how a new
grid-space cluster box relates to `ensureSubgraphSpacing`). Every claim below
was checked against `packages/ascii-renderer/src` at `7957767`. Nothing under
`src/` changed to produce this.

## Decision

Paths are relative to `packages/ascii-renderer/src/`.

### Corrections to the issues

- **"The boundary must be final before routing" can't hold in drawing space.**
  `calculateSubgraphBoundingBoxes` (`grid.ts:1219`) runs _after_ the per-edge
  routing loop (`grid.ts:1173-1195`), because node `drawingCoord`s
  (`grid.ts:1199`) depend on column widths that routing itself mutates
  (`applyLabelLine` widens a column, `edge-routing.ts:1041`). Only grid
  coordinates are stable across routing, so cluster routing must use grid
  coordinates only.
- **`ensureSubgraphSpacing` has no grid-level equivalent and needs none.** It is
  drawing-space only, touches root subgraphs only, and assigns only `minX`/`minY`
  (`grid.ts:516-526`), so it only ever moves a top or left wall inward. The
  bottom (`maxY`) and right (`maxX`) walls, which are the exit walls in TD and
  LR, are never touched, and nodes never move.
- **A shared traversal helper is unnecessary.** `convertSubgraph` already
  flattens child nodes into every ancestor's `nodes` (`converter.ts:323-324`), so
  the grid box is a plain min/max over `sg.nodes`. The drawing box adds padding,
  label space, and label-width widening (`grid.ts:470-497`) that don't exist in
  grid space. Don't share code, and don't put `gridMin*`/`gridMax*` on
  `AsciiSubgraph` (two sources of truth on one type).
- **`canBundle`'s label rule is not the operative exclusion.** It rejects labeled
  edges (`edge-bundling.ts:158`) but also any edge whose endpoints sit in
  different subgraphs (`:168`), which is every cluster-crossing edge. Cluster
  exits never bundle, labeled or not.
- **`edge-routing.ts` must be touched, and not only for labels.**
  `rerouteAroundStyleConflicts` (`grid.ts:254`) calls `determinePath` directly
  (`grid.ts:270`), so a dispatch placed only in `createMapping`'s loop would be
  silently undone on any style-conflict reroute.
- **Why the wrong wall today.** `determineStartAndEndDir` (`edge-routing.ts:95`)
  picks the departure face from the anchor's position relative to the target, so
  a lower-right target gets `Right` and punches through the anchor's side. The
  `done` label overwrites the cluster's bottom border in the #1135 repro because
  `determineLabelLine` (`edge-routing.ts:848`) centers it on the one straight
  segment from the anchor's face to the target, and that midpoint is the wall
  row.

### #1164: label placement

1. **`cluster-boundary.ts` builds a route and does not own label logic.** Export
   `buildClusterExitRoute(graph, edge)` returning
   `{ path, startDir, endDir, labelSegment } | null`, the same shape as
   `ParallelLaneRoute` (`edge-routing.ts:434`). `routeEdge` (`pathfinder.ts:433`)
   stays a bare-path primitive, untouched.
2. **`determinePath` consumes it**, mirroring the lane branch
   (`edge-routing.ts:662-704`): set `edge.path/startDir/endDir`, then call the
   private `applyLabelLine` with `route.labelSegment`. `determineLabelLine`'s
   early-return guard (`:850`, today `parallelLane.index > 0`) also skips
   cluster-exit edges. `applyLabelLine` stays unexported.
3. **Route shape (TD; LR is the mirror).** A stub runs from the anchor's
   flow-side face straight to the gutter cell `(anchorCol, gridMaxY+1)`, then an
   outside leg (`routeEdge` from that cell to the target's entry face; `endDir`
   is the opposite of the flow direction). Every engaged edge from one cluster
   shares the stub, the same same-style trunk overlap `edge-cell-styles.ts`
   already permits between siblings. Only the outside leg differs per edge. The
   exit _side_ is forced per cluster (per-edge sides are what reproduces the
   bug), and the exit _point_ is one shared trunk in v1; real mermaid's per-edge
   x-offsets are deferred. This settles #1148's open questions 3 and 5.
4. **Label segment = the first segment lying entirely outside the cluster**
   (path index >= 2), never the stub. In the fan-out case that is the horizontal
   run along the gutter row; for a straight-down target it is the single vertical
   segment below the gutter row. `drawTextOnLine` (`draw-arrows.ts:555`) places a
   vertical-segment label at or below the segment's first row (the gutter row
   centre), so it cannot land on the wall row.
5. **The gutter must clear the wall.** Wall row = last node row + 2 per nested
   box sharing that bottom edge (`grid.ts:477`); the gutter row centre is last row
   - 1 + `floor(h/2)` (`gridToDrawingCoord`, `grid.ts:82-86`). Default
     `paddingY`/`paddingX` is 5 (`types.ts:250-252`), which clears a single box, but
     both are user-configurable (`index.ts:45`). On engagement, set the gutter
     row/column size to at least `4 * k`, where `k` is the exited cluster's own box
     plus nested boxes sharing its bottom (right) edge.
6. **Engagement and interaction.** An edge is eligible only if it has a
   `clusterSource`, no `parallelLane`, and a target strictly past the cluster's
   flow-side edge (backward and sideways targets keep today's routing). A
   (cluster, exit) group engages only with >= 2 eligible edges, all-or-nothing:
   if the shared stub is not a straight run (the grid box can contain foreign
   nodes, and a non-bottom anchor can have a member below it), the whole group
   falls back to the untouched path. Parallel-lane siblings (same anchor and
   target, `parallelGroupKey`, `edge-routing.ts:310`) keep lane routing; that mix
   is a known v1 limitation.

### #1165: bounding-box timing

- Compute cluster grid boxes in a pre-pass inside `createMapping`, **after
  `assignParallelEdgeLanes` (`grid.ts:1143`, needed for eligibility) and before
  the per-edge loop (`grid.ts:1173`)**. Node placement (`:1122`) and
  `setColumnWidth` (`:1126`) are complete by then. Inputs are node `gridCoord`s
  only: `gridMinX = min(x)`, `gridMaxX = max(x + 2)`, likewise Y (blocks are 3x3,
  `NODE_BLOCK_SIZE`, `grid-occupancy.ts:90`; inclusive on both ends). Skip
  clusters with no nodes.
- Store the result as a `Map<AsciiSubgraph, ...>` on `AsciiGraph`, read by
  `buildClusterExitRoute` from both `determinePath` call sites.
- **Entry-side anchoring is deferred to a follow-up.** Entry is the side
  `ensureSubgraphSpacing` can move (top/left walls, inward). The exit design
  never depends on a drawn wall coordinate (the path crosses the wall by
  overdraw, as edges already do), so it is immune; a mirrored entry design needs
  its own check of that property.

## Consequences

**#1148 "Files touched" (replaces the list in its body):** `types.ts`
(`AsciiEdge.clusterSource?`, `AsciiGraph` cluster-plan map), `converter.ts` (tag
edges; subgraphs must exist before edges are built), `grid.ts` (pre-pass only),
`edge-routing.ts` (dispatch in `determinePath`, guard in `determineLabelLine`),
and new `cluster-boundary.ts`. Not touched: `pathfinder.ts`, `edge-bundling.ts`,
`territory.ts`, `draw-subgraphs.ts`, `AsciiSubgraph`.

**#1148 test plan additions, in priority order:**

1. Primary repro, labeled multi-exit: the #1135 composite-state case
   (`done`/`fail`) and its plain-flowchart twin. Assert neither label overwrites
   the cluster border row, both edges leave through the flow-side wall, and the
   trunk is shared.
2. Overlapping root subgraphs plus a multi-exit cluster such that
   `ensureSubgraphSpacing` fires (assert its `min*` mutation actually happens in
   the fixture); exit edges still cross the drawn bottom/right wall and reach
   their targets.
3. Small `paddingY`/`paddingX` (for example 2) to exercise the gutter-size rule;
   a nested cluster sharing the bottom edge (`k = 2`).
4. A style-conflict reroute of a cluster-exit edge keeps its cluster shape.
5. Fallbacks unchanged: single-exit cluster (byte-identical baseline), backward
   target, parallel-lane sibling, non-straight stub, empty cluster.
6. LR mirror of test 1. Only the Composite States visual baseline may change;
   any other change is a red flag.

Per-edge exit x-offsets, entry-side anchoring, and mixed lane/cluster groups are
deliberately out of v1.
