---
'@zombie-mermaid/svg-renderer': patch
---

Output change: an SVG flowchart `sm-circ` ignores `style` and `classDef` (fill, stroke, stroke-width and stroke-dasharray) and keeps the default node colours, as Mermaid 12.3.0 does. Closes #2680.
