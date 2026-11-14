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
