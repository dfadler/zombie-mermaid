---
'@zombie-mermaid/ascii-renderer': patch
---

Cut ASCII render time and memory on large flowcharts: per-edge overlay layers now share one blank column until first written, instead of each allocating a full canvas (about 4x faster and 9x less heap at 200 nodes, output unchanged) (#1458).
