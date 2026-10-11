---
'zombie-mermaid': minor
---

XY chart y-axis ticks and default range now match Mermaid. Ticks use d3's `ticks(min, max, 10)` (about 10 labels instead of 5-10 with a coarser step), and without a `y-axis` range the axis spans the raw data min/max instead of padding it 10% and flooring near zero. Affects SVG and ASCII output. Closes the decision in #1705.
