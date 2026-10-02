---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

In ASCII output, a subgraph wall that gets pushed outward by an edge no longer lands on its node's box, so the edge joins the wall cleanly instead of colliding with the node border.
