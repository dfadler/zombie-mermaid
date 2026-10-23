---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

Output change: horizontal XY chart SVGs now reserve room on the right for half the last value-axis label, so a wide label such as 220000 is no longer clipped at the viewBox edge.
