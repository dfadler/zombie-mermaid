---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII flowcharts: an edge addressed to a subgraph id (`Y --> Sub`) now ends at the frame's wall instead of crossing it and ending on a member inside, and the subgraph is placed past the sources of such edges, so `W --> Y --> Sub` no longer lands Y beside the frame with a sideways edge across its wall.
