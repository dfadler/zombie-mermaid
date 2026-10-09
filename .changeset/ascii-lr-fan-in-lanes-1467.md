---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: in LR flowcharts, once a shared run into a node already carries two labeled edges, further labeled edges into that node take their own lane instead of stacking on it, so their labels can be told apart (#1467).
