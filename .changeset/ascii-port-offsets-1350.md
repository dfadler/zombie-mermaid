---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: an edge that arrives at a node port another edge leaves from (or the reverse) is now drawn in its own column instead of piled into one corridor, so a back edge into a node no longer shares a stroke with the edges leaving it. Edges that share a port in the same direction (fan-out, fan-in, bundles) keep their shared trunk (#1350).
