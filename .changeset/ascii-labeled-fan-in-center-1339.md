---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: in top-down flowcharts, a node fed by several labeled edges is now centred between its parents, as in Mermaid, instead of sitting under the first one. Each parent drops down its own column and enters the node through its side, so every label keeps a stroke of its own. This also stops one label from vanishing when three or more labeled edges meet at a node. The node stays under the first parent in left-to-right graphs, when a parent also feeds another node, and when the node is on a cycle.
