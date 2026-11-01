---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: ASCII flowcharts keep two opposing edges between the same pair of nodes as two strokes when one end is a diamond or a slanted (parallelogram) shape, instead of drawing them as one merged route, and draw them without crossing. In LR/RL a decision with such a pair sends its branches out the right face and takes the return into its lower right face, as mermaid does, instead of running both strokes down from the bottom vertex ([#2492](https://github.com/dfadler/zombie-mermaid/issues/2492)).
