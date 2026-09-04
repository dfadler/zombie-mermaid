---
'zombie-mermaid': patch
---

ASCII XY charts: multiple `bar` series in the same `xychart-beta` diagram now overlay at the same x-position (or row, for horizontal charts) per category, matching real mermaid.js — a later series paints over an earlier one, so the taller bar is visible. Previously they rendered as separate, grouped side-by-side sub-columns.
