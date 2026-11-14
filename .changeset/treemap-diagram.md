---
'zombie-mermaid': minor
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
'@zombie-mermaid/mcp': patch
---

Add Mermaid `treemap-beta` / `treemap` diagrams: parser, an SVG renderer that ports d3-hierarchy's squarified layout (cell positions and the viewBox agree with mermaid@12.3.0 to 0.01px) and an ASCII tree list with share bars. Rows nest by indentation, `title` and `classDef` / `:::class` (fill, stroke, stroke-width, color) are read; the `treemap` init keys are not yet.
