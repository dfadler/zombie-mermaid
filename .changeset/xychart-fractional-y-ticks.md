---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
---

Fix XY chart value-axis tick labels repeating when the data range is narrow. Labels now take their precision from the tick step instead of rounding to whole numbers above 10, so a 99-102 range reads `99, 99.5, 100, ...` and a single value no longer shows the same number at every tick.
