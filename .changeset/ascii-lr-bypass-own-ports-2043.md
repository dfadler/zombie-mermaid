---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: in an LR flowchart, an edge that jumps a node on its own row (`A --> C` past `B`) now runs under the row, out of the bottom of its origin and into the bottom of its target. It used to leave the origin along the line of `A --> B` and join `B --> C` in one arrowhead before the target. A node that a jumping edge enters while another leaves it, a node with a self-loop or backwards edge, and labeled jumping edges that share an end keep the previous route. Fixes [#2043](https://github.com/dfadler/zombie-mermaid/issues/2043) and [#2044](https://github.com/dfadler/zombie-mermaid/issues/2044).
