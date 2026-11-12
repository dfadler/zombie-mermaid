---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: in a `BT` flowchart (and a `direction BT` subgraph) the cluster title sits at the top of its box, as mermaid@12.3.0 draws it in every direction, instead of at the bottom. TD, LR and RL output is unchanged.
