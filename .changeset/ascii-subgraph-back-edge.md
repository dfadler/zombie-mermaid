---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII flowcharts and architecture diagrams: a cycle whose edges cross between sibling subgraphs (e.g. `A --> C --> E --> A` with each node in its own subgraph) no longer throws `Node "A" has no gridCoord`. Closes #1197.
