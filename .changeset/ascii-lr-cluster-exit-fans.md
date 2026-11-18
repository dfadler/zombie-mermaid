---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

Output change, ASCII: in a left-to-right or right-to-left diagram, three or more edges that leave one subgraph for one target now go round the target as mermaid@12.3.0 routes them (`Five`, `Six` and `Nine Cluster Exit Siblings`, `Cluster Exit Siblings with No Other Exit`): the first siblings rise beside the cluster, run over the target and drop beside it, the last ones dip under it the same way, and the middle one stays straight, nested so none cross. The cluster's exits sit two rows apart and the target's entries one apart, as mermaid's ports are, so the drop is the longer leg. Top-down and bottom-up diagrams are unchanged.
