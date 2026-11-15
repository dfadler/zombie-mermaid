---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

Output change, ASCII: a gantt chart now shades `excludes` days with `·` (`,` in ASCII mode) on cells no bar covers, and draws the `todayMarker` as a `│` (`|`) column when the current date is inside the chart's range, like the SVG; the legend names both. Gantt: Weekday excludes and Statuses, milestone and weekends are the samples that change.
