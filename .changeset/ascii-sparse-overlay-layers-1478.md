---
'@zombie-mermaid/ascii-renderer': patch
---

Cut memory and time on large ASCII flowcharts: per-edge overlay layers now share a blank column until a cell is written, instead of allocating the full canvas area for every edge (#1478).
