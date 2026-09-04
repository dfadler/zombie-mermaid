---
'zombie-mermaid': patch
---

ASCII XY charts: a vertical (default-orientation) `xychart-beta`'s y-axis title (`y-axis "Title" min --> max`) now renders as its own row above the y-axis gutter. Previously `renderVertical` read the title only to compute the axis range and never actually drew it, while the x-axis title and the horizontal-chart layout's own y-axis title both already worked correctly.
