# ASCII graph layout takes layer, order and port hints from ELK when available

Status: accepted (PR 1 landed the seam and the measurement; PR 3 reads the hints in flowchart and state placement; PR 4b reads the edge-end faces and their order; same-pair lane groups, self-loops and cleanup follow)

## Decision

`@zombie-mermaid/ascii-renderer` consumes an optional injected layout provider (`registerAsciiLayout`, `layout-hints.ts`).

- A provider returns per node its layer, in-layer rank and cross-axis centre, and per edge end the face (`T`, `B`, `L`, `R`) and its rank on that face.
- The root entry, CLI and MCP register one built on `layoutFlowchartSync` and `layoutErDiagramSync`; without a provider or without `elkjs`, the grid keeps its own placement. No ELK code moves into `ascii-renderer`.
- Scope: flowchart and state (`grid.ts`) and ER (`er-diagram.ts`); class, architecture and the rest are untouched.
- Re-baselining is gated on a topology-agreement score (`scripts/ascii-topology.ts`) measured before and after each placement PR; moved snapshots must not lower it.
- Supersedes "the ASCII renderers don't touch ELK at all" in `layout-architecture-scoping.md`.

Full write-up: https://github.com/dfadler/zombie-mermaid/issues/2645#issuecomment-6884746861

## Known grid limit: edge labels widen node columns (#3141)

Slots (`trackSlots`) follow ELK's cross-axis centres, but the grid then grows a column to fit an edge label, and the box of the node standing in that column grows with it. On `ascii-longest-path-layering` A and C are drawn 26 cells wide, B 5 and D 9, where the layout has them equal. Alignment, which divides centre offsets by node size, scores 1/6 there (13/21 on `ascii-feedback-edge-sibling-order`); layers, order and faces still match. mermaid@12.3.0 puts D 105 px right of C (0.69 node widths); the grid puts it 0.23 away. Closing the gap means taking label width out of node columns, which moves every snapshot with a wide edge label, so it is a separate placement change gated on the topology score, not part of the adapter. Tracked in #3141.
