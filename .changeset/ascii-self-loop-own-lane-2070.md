---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII flowcharts: a self-loop on a node that also has incoming and outgoing neighbours no longer runs along another edge's lane in the gutter beside its node. The gutter is widened where the loop shares cells with an edge that does not touch its node, so the loop is drawn as a stroke of its own, nested inside that edge, in all four directions. Fixes [#2070](https://github.com/dfadler/zombie-mermaid/issues/2070).
