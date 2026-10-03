---
'@zombie-mermaid/core': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
---

SVG: an edge between a node and a subgraph that contains it (`B --> Sub` with `B` inside `Sub`, or `Sub --> B`, or between nested subgraphs) is no longer drawn as a degenerate stub. Real mermaid.js 11.17.2 draws no line for it (a zero-length path), and now both renderers omit it through one shared check in `@zombie-mermaid/core` (#1310).
