---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: when two or more edges are addressed to one subgraph (`X --> Sub`, `Y --> Sub`), a source that sits off the landing column now turns onto the frame's wall and its arrowhead points into the cluster, instead of ending in a sideways arrowhead (`◄`, `▲`) that overwrote its sibling's (#1181).
