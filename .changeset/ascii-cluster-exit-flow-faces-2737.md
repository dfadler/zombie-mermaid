---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: edges from one subgraph to the same node, straight ahead of it, now leave the cluster's flow-side wall and enter the target's flow-side face as parallel strokes, left to right in source order, like mermaid@12.3.0, instead of looping round the target's side faces out of order. Labels wider than one character keep the side faces. Refs #2737.
