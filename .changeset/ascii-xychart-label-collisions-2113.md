---
'@zombie-mermaid/ascii-renderer': patch
'zombie-mermaid': patch
---

ASCII XY charts no longer run category and value-axis labels together or overwrite them with the next label. A word label that would touch its neighbour is shortened to its band with an ellipsis (`Marke…`); numbers, dates and value-axis ticks that would touch are thinned to every n-th label, always leaving at least one blank cell. Tick marks stay.
