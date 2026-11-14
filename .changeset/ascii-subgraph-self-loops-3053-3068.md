---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: duplicate self-loops on a member of a subgraph with its own `direction` now draw one nested hook each over the node, as mermaid@12.3.0 does (TD, LR and RL diagrams), and a self-loop's run below its node stays inside its frame instead of sharing the frame's bottom wall. Labels in a frame flipped inside an RL diagram no longer move to the wrong node.
