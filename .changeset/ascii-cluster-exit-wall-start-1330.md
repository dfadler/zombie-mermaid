---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: edges leaving a subgraph (`S --> T`, two or more exits) now start on the frame's own wall, as a tee on the wall, instead of on the border of the node inside it, so the arrow reads as leaving the subgraph and the inner node's border stays unbroken (#1330).
