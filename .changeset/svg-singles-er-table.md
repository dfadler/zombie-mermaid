---
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/core': patch
---

Output change: ER entities are drawn as mermaid 12.3.0 draws them: a table with type, name, key and comment columns (the comment column was dropped before), lines between rows and columns, and an attribute-less entity as a taller box with the name centred. Circle (`--o`) and cross (`--x`) terminators use mermaid 12.3.0's `circleEnd-margin` / `crossEnd-margin` size.

Output change: `mergeEdges` now defaults to `false`, so fan-out and fan-in edges each keep their own port on a node, as in mermaid 12.3.0. Pass `mergeEdges: true` for the shared trunks. Edge ends in a compound (subgraph) layout are kept on their node's face.
