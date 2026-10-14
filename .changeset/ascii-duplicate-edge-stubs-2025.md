---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII flowcharts: duplicate self-loops, and reciprocal or duplicate edges between two nodes, no longer leave a stroke that ends in blank space or a canvas of unequal line widths. A second self-loop stays off its node's corner, and a parallel-lane search that runs out of room keeps the edge's earlier route instead of a placeholder hundreds of rows out. Fixes [#2025](https://github.com/dfadler/zombie-mermaid/issues/2025), [#2028](https://github.com/dfadler/zombie-mermaid/issues/2028) and [#2030](https://github.com/dfadler/zombie-mermaid/issues/2030).
