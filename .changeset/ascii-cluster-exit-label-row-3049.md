---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

Output change, ASCII: in a top-down diagram, a composite state or subgraph with exactly two labelled exits, one straight down and one that jogs right, now puts both labels on the jog row, the straight one on its own stroke to the left. mermaid@12.3.0 draws the pair at one height in that order; before, the straight exit's label sat near its target, so the labels read in the other order and the gap under the cluster was taller. State: Composite States (`done` and `fail`) is the sample that changes.
