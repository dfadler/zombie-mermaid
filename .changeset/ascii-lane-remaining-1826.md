---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII flowcharts: more parallel-lane groups keep one arrowhead per edge. A top-down or bottom-up forward group and its back group between the same two nodes (for example four edges down and two back) lengthen the faces they share; a subgraph whose only exit is a group of three or more edges now uses the cluster exit lanes; and eight or more edges from one subgraph to one target give the target a longer face (#1826, #1689).
