---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
---

A subgraph with its own `direction` is laid out by it alone, as mermaid@12.3.0 does, whatever the diagram's direction. Self-loops on its members are drawn over the top of the node in an LR or RL frame and on its left in a TD or BT one, in SVG and in ASCII (a `direction LR` frame in a TD diagram drew its loops on the left, between the nodes). In ASCII an LR or RL frame under a `BT` diagram, and a TD or BT frame under an `RL` one, no longer inherit the diagram's mirror on the other axis: its nodes, title and loop hooks sit where they do under a TD diagram. The ASCII topology script gains `--misses`, which lists every edge end whose face differs from ELK's.
