---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII flowcharts: when nested subgraphs both have multiple exits, the outer subgraph's exit trunk is now measured after the inner subgraph's gutter widening has shifted the outer wall, so the outer exits no longer fan out of the wall column itself. Closes #1213.
