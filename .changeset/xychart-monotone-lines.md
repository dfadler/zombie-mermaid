---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

XY chart line series now use monotone cubic interpolation, so the smoothed curve no longer overshoots the data (a peak above the maximum, or a dip below a zero baseline).
