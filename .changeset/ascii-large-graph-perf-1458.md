---
'@zombie-mermaid/ascii-renderer': patch
---

Speed up ASCII rendering of large flowcharts: per-edge overlay layers now track the cells they touch, so merge and role passes no longer rescan the whole canvas for every edge (#1458).
