---
'@zombie-mermaid/core': patch
'@zombie-mermaid/svg-renderer': patch
---

Round every coordinate/dimension interpolated into generated SVG markup (flowchart, ER, class, and sequence diagrams) to 2 decimal places instead of emitting full floating-point precision (e.g. `142.38427299999998`). Output is visually identical — 2 decimal places is well beyond the smallest rendering difference a browser draws — but noticeably smaller and easier to read or diff by hand. `xychart`'s own existing rounding is unchanged. (Ported from a fix by GauBen, upstream [lukilabs/beautiful-mermaid#77](https://github.com/lukilabs/beautiful-mermaid/pull/77).)
