---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: an edge label is now chosen once every edge is routed, so it avoids a segment another edge also runs along and a segment another label already holds (a hidden or misattributed label, #1347). An edge that arrives at a node's side port is also drawn on its own row, apart from an edge leaving the same side, as already done for top and bottom ports.
