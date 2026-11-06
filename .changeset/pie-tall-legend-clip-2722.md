---
'@zombie-mermaid/svg-renderer': patch
---

Output change: a pie SVG whose legend is taller than the 450px frame is clipped at the top and bottom like Mermaid 12.3.0, instead of growing the viewBox to show every row.
