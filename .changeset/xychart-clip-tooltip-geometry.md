---
'@zombie-mermaid/svg-renderer': patch
---

Fix: in interactive XY charts, a bar that overshoots the axis range now gets a hover area clipped to the plot, like the bar Mermaid 12.3.0 clips there, instead of one that extends past the top of the chart. Internal: the unused xychart legend layout (`XY.legend*`, legend fonts) is gone; `PositionedXYChart.legend` still carries the "Bar N" / "Line N" labels, now without geometry.
