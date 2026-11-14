---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
---

A self-loop on a member of a subgraph with its own `direction` is drawn by that direction, as mermaid@12.3.0 does, not by the diagram's: over the top of the node in an LR or RL frame, on its left in a TD or BT one, in SVG and in ASCII (a `direction LR` frame in a TD diagram drew its loops on the left). In ASCII the hooks of an RL or BT frame inside an RL or BT diagram now start on the side mermaid starts them. The ASCII topology script gains `--misses`, which lists every edge end whose face differs from ELK's.
