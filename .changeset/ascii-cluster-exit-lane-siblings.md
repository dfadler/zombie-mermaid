---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII flowcharts and state diagrams: a subgraph (or composite state) with two edges to the same target (parallel lanes) plus other exits now routes all of them through the cluster's shared exit trunk. The second lane enters the target through a side face instead of running along its border, and each exit's label sits on its own leg. Before, one extra exit punched through the cluster wall, and with two extra exits the second lane left through the side wall with both lane labels on the wall row. Refs #1182.
