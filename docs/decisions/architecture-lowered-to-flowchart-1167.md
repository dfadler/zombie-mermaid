# architecture-beta is lowered to the flowchart model; C4 and pie are not

Status: implemented

## Context

[#1167](https://github.com/dfadler/zombie-mermaid/issues/1167) added three diagram types: `architecture-beta`, C4 and pie. Each needed a way to reach SVG and ASCII. The two options are to lower the parsed diagram to the flowchart model (`MermaidGraph`) and reuse the flowchart layout and renderers, or to write a dedicated layout and renderer.

The three types ended up on different sides of that choice, and only one of them is lowered. [#1550](https://github.com/dfadler/zombie-mermaid/issues/1550) describes all three as lowered; that was true of C4 for a few hours on 2026-09-29 and was never true of pie.

## Decision

- **`architecture-beta` is lowered.** `architectureToGraph` (`packages/mermaid-parser/src/architecture/to-graph.ts`) maps group to subgraph, service to node (the icon picks the shape), junction to a small filled circle and edge to edge. SVG goes through ELK and ASCII through the grid router, both via the registry entry in `packages/svg-renderer/src/registry.ts` and `packages/ascii-renderer/src/architecture.ts`. Introduced in `bd266cb6` (2026-09-29).
- **C4 has dedicated renderers.** The first cut (`70196e80`, #1188) lowered C4 the same way; `e526333a` (2026-09-29) replaced it with C4-specific SVG and ASCII renderers: person glyph, cylinders and queues, boundary frames, `[technology]` lines, `Rel_*` placement hints. SVG uses its own row layout (`c4/layout.ts`), not ELK.
- **Pie has dedicated layout and renderers.** A pie is not a graph, so there was nothing to lower (`70f3c780`, 2026-10-06; geometry follows Mermaid's `pieRenderer.ts`).

Why architecture stays lowered: it is boxes in nested boxes joined by edges, which the flowchart pipeline already draws, and `padding`, `nodeSpacing`, `layerSpacing` and `mergeEdges` keep working on it. Why C4 did not: it needs shapes and labels a flowchart node cannot express. The C4 reason is read from the `e526333a` commit message and the glyph list, not from a recorded discussion.

## Consequences

- Architecture output is not positioned on Mermaid's port grid. Ports only pick the flow direction and which way each edge points; `align row` / `align column` are accepted and ignored; icons beyond `database`, `disk`, `cloud` and `internet` all draw as rectangles; ASCII inherits the flowchart router's known mis-placements. These limits are listed in `docs/diagrams.md` ("Architecture Diagrams") and are the price of this decision, not bugs to chase one by one.
- Anyone proposing "match Mermaid's architecture layout exactly" is proposing a dedicated layout and renderer, the C4 route. That is a new decision, and C4 shows the cost: two renderers (SVG and ASCII) plus a parser change for hints.
- Anything that changes flowchart layout or the ASCII router also moves architecture output. Its snapshots (`acc_title_descr_architecture.txt` and the architecture samples) are flowchart-pipeline consumers.
- Layout options apply to architecture and not to C4 or pie (`docs/api-reference.md`, "Which diagram types honor the layout options").
- Not verified: whether a dedicated architecture renderer was ever costed. Nothing in the issue or PR history shows it.
