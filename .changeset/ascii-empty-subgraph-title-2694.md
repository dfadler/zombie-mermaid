---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: an empty flowchart subgraph is no longer dropped from the ASCII output; its title is printed as plain text next to the first node, like mermaid@12.3.0 (which draws a zero-height cluster, no frame). An edge to an empty subgraph keeps a box around the title. Refs #2694.
