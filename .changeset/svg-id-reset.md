---
'@zombie-mermaid/core': patch
---

Export `resetSvgIdCounters()` so callers rendering many diagrams in one process can make the generated `zm-title-N` / `zm-desc-N` SVG ids reproducible per batch. Output is unchanged for a fresh process.
