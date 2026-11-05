---
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/core': patch
---

Output change: `architecture-beta` SVG now draws edges 3px wide as Mermaid does, wraps a service label longer than 1.5 tiles onto further lines instead of overflowing, widens a group around a label that cannot wrap, takes the group border colour from the theme (`--_node-stroke`) so it follows dark mode, and ignores `curve` as Mermaid does. `MermaidSubgraph` and `PositionedGroup` gain `architecture?: boolean` (an architecture group's `icon` is now absent rather than `''`), and `MermaidEdge.acrossFlow` is marked `@deprecated`. The ELK-error message and the docs no longer list architecture among the diagrams that need `elkjs`.
