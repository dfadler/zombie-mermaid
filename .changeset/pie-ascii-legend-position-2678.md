---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

Pie ASCII output now places the table for every `pie.legendPosition`, as mermaid@12.3.0 places the legend: `right` (the default, and any unknown value) puts it in a column right of the bar, `left` left of it, `center` centred on it, `top` above and `bottom` below. The bar sits on the table's middle row. Pies without a `legendPosition` now print the table beside the bar instead of below it.
