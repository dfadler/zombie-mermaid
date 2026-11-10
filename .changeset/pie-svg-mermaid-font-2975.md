---
'zombie-mermaid': patch
---

Pie SVG default font change: with no `font` option, a pie chart is now drawn and sized in mermaid@12.3.0's own font stack (`"trebuchet ms", verdana, arial, sans-serif`), measured with Trebuchet MS widths, so its canvas matches 12.3.0 to within a pixel (a title-only pie is 337px, not 346px). An explicit `font` (or `embedFont: 'subset'`, which means Inter) is used for both drawing and sizing, as before. `layoutPieChart` takes an optional `{ font }`.
