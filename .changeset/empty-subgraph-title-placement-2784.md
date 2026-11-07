---
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
---

Output change: an empty flowchart subgraph's title hangs from the middle of its slot in SVG, and in a left-to-right ASCII diagram an empty subgraph used as an edge endpoint is bare text between two arrows instead of a boxed node, as in mermaid@12.3.0. Refs #2784.
