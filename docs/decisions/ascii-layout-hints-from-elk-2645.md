# ASCII graph layout takes layer, order and port hints from ELK when available

Status: accepted (PR 1 landed the seam and the measurement; PR 3 reads the hints in flowchart and state placement; ER, ports and cleanup follow)

## Context

Five ASCII entries stay parked because they differ from mermaid@12.3.0 in
layout decisions the grid and the ER router make on their own: layer placement,
in-layer order, which face each edge end uses and in what order along it. Three
sessions could not close the gap with local router changes (the lane-base fix
broke four tests, the BACKUD experiment moved 22 tests and snapshots, the ER
prototype moved nine snapshot mismatches, two of them worse). The SVG path
already reproduces mermaid's layers, order and alignment on all five samples
through ELK. Method, measurements and the option comparison are in the
[plan comment on #2645](https://github.com/dfadler/zombie-mermaid/issues/2645#issuecomment-6671913074);
map: [#2606](https://github.com/dfadler/zombie-mermaid/issues/2606).

## Decision

`@zombie-mermaid/ascii-renderer` consumes an optional injected layout provider
(`registerAsciiLayout`, `layout-hints.ts`). A provider returns, per diagram,
hints: for each node its layer (0 is the source side, whichever way the flow
points), its rank inside the layer along the cross axis, and its cross-axis
centre; for each edge end the face (`T`, `B`, `L`, `R`) and its rank among the
ends on that face. The root entry, the CLI and MCP register a provider built
on `layoutFlowchartSync` and `layoutErDiagramSync` with mermaid's pixel node
sizes. Without a provider, or when `elkjs` is not registered (the provider
returns `undefined`), the grid keeps its own placement. No ELK code moves into
`ascii-renderer`.

Scope: flowchart and state (`grid.ts`) and ER (`er-diagram.ts`); class,
architecture and the rest are untouched. "Match" means same layer per node,
same in-layer order, alignment where the grid can show it, and each edge end on
the same face in the same order along it. Equal distances and the same stroke
route are not required. A residual gap must name a real grid limit.

Re-baselining is gated on a scripted topology-agreement score
(`scripts/ascii-topology.ts`, measured before and after each placement PR);
moved snapshots must not lower it, and a human looks at any snapshot where it
drops. Terms: a _layer_ is a set of nodes whose flow-axis centres are within
20 px (ELK) or one grid cell (grid) of each other; _order_ is the rank by
cross-axis centre inside a layer; the _alignment_ measure is a pair's
cross-axis centre offset in node widths.

This supersedes "the ASCII renderers don't touch ELK at all" in
[layout-architecture-scoping.md](layout-architecture-scoping.md); the rest of
that doc stands. It builds on the registration model of
[elkjs-optional-peer-1370.md](elkjs-optional-peer-1370.md): the provider uses
the same `registerElk` constructor or the Node auto-load, and degrades to the
grid when neither exists.

## Consequences

- ASCII output of the root entry will depend on whether `elkjs` is available
  (always in Node, the CLI and MCP; in a browser only after `registerElk`).
  The standalone `@zombie-mermaid/ascii-renderer` package and
  `zombie-mermaid/ascii` register nothing and keep grid output until a shared
  layout package exists ([#2686](https://github.com/dfadler/zombie-mermaid/issues/2686)).
  Tests that assert hint-driven output must register the provider.
- Translating pixel node sizes into cell sizes is a separate adapter question
  ([#2685](https://github.com/dfadler/zombie-mermaid/issues/2685)); until then
  the hints carry order and layer, not distances.
- Degenerate inputs: an empty graph gives empty hints; a single node is layer 0,
  order 0; a node with a self-loop or a cycle is placed by ELK's own cycle
  breaking, and an edge whose endpoints or path ELK did not return has no edge
  hint (the grid chooses). Ties in the cross-axis rank are broken by input
  order.
- Output with the provider registered is byte-identical to output without it
  in this PR, since nothing reads the hints. Later PRs change that in steps:
  ER, then flowchart and state placement, then ports, then cleanup of the
  heuristics ELK supersedes (plan in the #2645 comment).
- ascii-renderer's bundle budget (`scripts/bundle-size-budget.json`) is the
  constraint on how much hint consumption the grid can carry.

## Rejected

- **Per-entry router patches.** Three attempts could not reach the target.
- **Promoting the variant E rasterizer (`ascii-layout`).** It covers flat
  flowcharts only (no subgraphs, state or ER) and scales the boxes.
- **Re-implementing ELK's layering in the grid.** The tie-breaks are not
  derivable.
