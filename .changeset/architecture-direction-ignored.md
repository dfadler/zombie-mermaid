---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
---

Architecture: ignore a `direction` override in both SVG and ASCII. mermaid@12.3.0 has no direction for `architecture-beta`; the edge ports place every service, so ASCII no longer falls back to flowchart placement and SVG no longer transposes the grid.
