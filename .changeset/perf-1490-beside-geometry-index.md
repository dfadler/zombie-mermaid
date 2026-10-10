---
'@zombie-mermaid/ascii-renderer': patch
---

Speed up ASCII label placement on graphs with many labelled edges: `besideGeometryFree` now reads a per-layout row index of drawn edge segments instead of rescanning every edge for each candidate. Output is unchanged.
