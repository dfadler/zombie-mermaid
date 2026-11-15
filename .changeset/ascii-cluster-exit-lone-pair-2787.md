---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

Output change, ASCII: in a top-down diagram, two edges from one subgraph to a node straight below it, with no other exit from the subgraph, now leave the subgraph's bottom wall and enter the target's top face as two parallel strokes. mermaid@12.3.0 draws the pair that way; before, the second edge left the cluster's side wall and entered the target's side face.
