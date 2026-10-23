---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

Output change: horizontal XY charts now draw line series as straight segments in category order, as mermaid does, instead of a smoothed curve that could double back on a series that is not monotone in value. Vertical charts stay smoothed.
