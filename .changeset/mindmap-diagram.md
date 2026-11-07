---
'zombie-mermaid': minor
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
'@zombie-mermaid/mcp': patch
---

Mindmaps. `mindmap` diagrams now parse and render to SVG and ASCII/Unicode text ([#2840](https://github.com/dfadler/zombie-mermaid/issues/2840), under [#2085](https://github.com/dfadler/zombie-mermaid/issues/2085)). `DiagramType` gains `'mindmap'` and `detectDiagramType` routes a `mindmap` header to it. `@zombie-mermaid/mermaid-parser` adds `parseMindmap` with the `Mindmap`, `MindmapNode` and `Positioned*` types, a port of Mermaid's jison grammar (all seven shapes, `::icon()`, `:::class`, quoted and Markdown labels, Mermaid's indentation rules and its "only one root" error). The SVG renderer draws Mermaid 12.3.0's mindmap: its node shapes and sizes, its colour sections and edge widths, and its layout, a dependency-free port of the CoSE-Bilkent force layout Mermaid runs through cytoscape (bit-identical to it for a tree). `pnpm run mindmap:oracle` checks every sample against real mermaid (12.1.0, GitHub's version, 12.2.0 and 12.3.0 render mindmaps identically): structure exactly, shapes and layout from Mermaid's own measured node sizes. Colours follow the theme and label widths use this library's font, so positions drift from Mermaid's by the text-width difference; the ASCII output is an indented tree (Mermaid has none). See `docs/known-differences.md`.
