# Cluster-exit anchoring (#1148): label placement and bounding-box timing

## Context

Prerequisite design questions for [#1148](https://github.com/dfadler/zombie-mermaid/issues/1148):
[#1164](https://github.com/dfadler/zombie-mermaid/issues/1164) (label placement
for cluster-boundary edges) and
[#1165](https://github.com/dfadler/zombie-mermaid/issues/1165) (grid-space
cluster box vs `ensureSubgraphSpacing`). Verified against
`packages/ascii-renderer/src` at `7957767`.

**Full notes, with file:line evidence and the test plan, are in
[this comment on #1148](https://github.com/dfadler/zombie-mermaid/issues/1148#issuecomment-5900857205).** This doc is the summary.

## Decision

- **Box timing (#1165).** Compute cluster grid boxes in a pre-pass in
  `createMapping`, after `assignParallelEdgeLanes` and before the per-edge
  loop, from node `gridCoord`s only. `ensureSubgraphSpacing` needs no grid
  equivalent: it is drawing-space only and moves only top/left walls, never the
  exit walls. No shared traversal helper, and no grid fields on `AsciiSubgraph`.
- **Routing.** A new `cluster-boundary.ts` builds the route
  (`{ path, startDir, endDir, labelSegment }`). `determinePath` dispatches to
  it, so style-conflict reroutes keep the cluster shape. The exit side is forced
  to the flow side, and all exits from one cluster share one trunk to a gutter
  cell past the box (v1). The gutter is sized to clear the wall for any padding.
- **Labels (#1164).** `determinePath` applies the label via `applyLabelLine`
  on the first segment lying entirely outside the cluster, never on the stub.
  `determineLabelLine` skips cluster-exit edges.
- **Engagement.** Needs at least 2 eligible edges, all-or-nothing. Backward
  targets and parallel-lane siblings keep today's routing.
- **Files touched:** `types.ts`, `converter.ts`, `grid.ts` (pre-pass only),
  `edge-routing.ts`, new `cluster-boundary.ts`.

## Consequences

Per-edge exit offsets, entry-side anchoring and mixed lane/cluster groups are out
of v1 ([#1181](https://github.com/dfadler/zombie-mermaid/issues/1181),
[#1182](https://github.com/dfadler/zombie-mermaid/issues/1182)). Blast-radius
confirmation: [#1183](https://github.com/dfadler/zombie-mermaid/issues/1183).
