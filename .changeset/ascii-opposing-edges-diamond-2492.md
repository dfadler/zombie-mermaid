---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: ASCII flowcharts keep two opposing edges between the same pair of nodes as two strokes when one end is a diamond or a slanted (parallelogram) shape, instead of drawing them as one merged route ([#2492](https://github.com/dfadler/zombie-mermaid/issues/2492)).
