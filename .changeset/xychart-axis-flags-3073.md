---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII xychart honours `xyChart.xAxis` / `yAxis` `showLabel`, `showTick` and `showAxisLine` like mermaid 12.3.0 (#3073): a hidden label leaves no row or column, a tick without its axis line is a lone stub, and a horizontal chart's category axis now draws its ticks.
