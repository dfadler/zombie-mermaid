---
'zombie-mermaid': minor
---

Pie charts now honor `%%{init: {"pie": {"donutHole": n}}}%%` in SVG output, cutting a hole of `n` times the radius (for `n` above 0 and up to 0.9, as in Mermaid). ASCII output is unchanged. `legendPosition` and `highlightSlice` are still unsupported.
