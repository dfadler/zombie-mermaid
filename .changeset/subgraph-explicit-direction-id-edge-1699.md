---
'zombie-mermaid': patch
---

SVG and ASCII: a subgraph's explicit `direction` is kept when the only edges touching it are to or from the subgraph's own id (`X --> S`, `S --> Y`), as in mermaid 12; an edge into a nested subgraph's id now crosses its parent, and the nested one follows the parent (#1699).
