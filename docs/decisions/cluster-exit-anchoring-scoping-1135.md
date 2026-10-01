# Scoping: consistent cluster-boundary edge exits in the ASCII renderer

Status: **scoping note, not a decision.** Written for
[#1135](https://github.com/dfadler/zombie-mermaid/issues/1135). No code
under `packages/ascii-renderer/src/**` was changed to produce this.

## Summary

A state-diagram composite state with two outgoing transitions to
differently-positioned targets renders inconsistently in ASCII: one
transition's line appears to leave from the cluster's own bottom border
(correct), the other appears to leave from the border of whichever inner
member node happens to stand in for the cluster (misleading). Real
mermaid's SVG output has both transitions leaving the cluster's bottom
border — so this is an ASCII-only fidelity gap.

Root cause, confirmed against the code: the converter's
`resolveSubgraphEndpoint` (`packages/ascii-renderer/src/converter.ts`,
line 247) redirects every edge leaving a cluster to the same single
stand-in member node, and none of `pathfinder.ts`/`territory.ts`/
`draw-subgraphs.ts` has any "cluster exit boundary" concept — each edge is
then routed independently by shortest-path search from that shared node,
so two edges from the same cluster can visibly exit through different
walls. Confirmed general (not state-diagram-specific) with a plain
flowchart repro. Real mermaid avoids this because dagre clips every edge
crossing a compound cluster boundary to the boundary itself; the ASCII
renderer has no equivalent concept, and adding one is a structural change
to code shared by everything routed through the flowchart/subgraph path
(flowchart and state diagrams; see Blast radius below) — too large a risk surface for a minimal patch.

Full investigation (confirmed repro, step-by-step root cause trace, the
plain-flowchart repro, and the reasoning against a minimal patch):
[#1135, investigation comment](https://github.com/dfadler/zombie-mermaid/issues/1135#issuecomment-5846509498).

## Decision

Not implementing a fix as part of closing out #1135. The composite-state
symptom is downgraded from "state-diagram bug" to "known instance of a
general ASCII cluster-exit-anchoring limitation" and tracked as such;
#1135 stays open only as the state-diagram-flavored repro of this general
issue, pointing here.

If someone picks up the general fix later, the shape of the work is:
give the pathfinder/`draw-subgraphs.ts` a per-cluster "exit anchor" pass
that runs before individual edge routing — compute one boundary exit
point per (cluster, flow-direction) pair shared by all edges leaving that
cluster in that direction, route each edge to/from that shared point, then
let the existing per-edge shortest-path routing take over for the segment
outside the cluster. That is new design work, not a fix to file directly
against #1135.

## Consequences

- The ASCII renderer keeps rendering composite-state (and general
  cluster) multi-exit transitions with inconsistent anchoring until the
  general fix above is designed and implemented as its own effort — this
  is a readability nit, not a correctness regression (the diagram remains
  readable and the labeled target is unambiguous).
- Any future "fix cluster edge exit anchoring" work should treat this as
  the design starting point rather than re-deriving the root cause, and
  should scope test coverage across flowchart and state diagrams, not
  just the state-diagram case that surfaced it (see Blast radius).
- Does not change `resolveSubgraphEndpoint`'s existing behavior (issue
  #65's stand-in-node approach) — a real fix would build on top of it
  (still need _a_ stand-in node per cluster per direction for the
  converter's edge list) rather than replace it.

## Blast radius (confirmed in #1183)

Flowchart and state diagrams only. `flowchart.ts` is the sole caller of
`convertToAsciiGraph` and `createMapping` (grep of `packages/`, `src/`,
`demo/`, `scripts/`), and it renders both diagram types. Class and ER
renderers do not import the converter, grid, pathfinder or edge-routing
modules; their only link to `draw-subgraphs.ts` is transitive through
`draw.ts`, for its multi-box helpers, and they never call the subgraph
drawers. Real renders confirm it: a `classDiagram` with two `namespace`
blocks draws no namespace box at all (classes only), and ER has no
grouping construct to parse. Earlier text (in this doc and in #1156, both now corrected) that named
class-with-namespaces and composite ER as affected was wrong.
