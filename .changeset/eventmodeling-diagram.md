---
'zombie-mermaid': minor
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
'@zombie-mermaid/mcp': patch
---

Event modeling diagrams. `eventmodeling` is parsed, drawn to SVG and rendered to ASCII/Unicode text instead of being rejected with "Invalid mermaid header", under the upstream-types umbrella ([#2085](https://github.com/dfadler/zombie-mermaid/issues/2085), [#2806](https://github.com/dfadler/zombie-mermaid/issues/2806)). `DiagramType` gains `'eventmodeling'` and `detectDiagramType` routes an `eventmodeling` header to it (case-sensitively, as Mermaid's detector does). `@zombie-mermaid/mermaid-parser` adds `parseEventModeling` with the `EventModeling` and `Positioned*` types, a port of the grammar in `@mermaid-js/parser` 2.0.1 and the database in Mermaid 12.3.0: `tf`/`rf` frames and their long forms, the five entity types, `Namespace.Name` identifiers, `->>` source frames, inline data and `data` blocks, `entity`/`note`/`gwt` (parsed, not drawn) and Mermaid's errors (duplicate frame ID; `title` and `accTitle` are syntax errors). `@zombie-mermaid/svg-renderer` adds `layoutEventModeling` and `renderEventModelingSvg`: Mermaid's swimlane, box and arrow geometry, with text widths from Trebuchet MS bold advances. `pnpm run eventmodeling:oracle` compares every swimlane, box, arrow and the drawing size with real mermaid.js and agrees on all gallery samples with mermaid 12.3.0. The ASCII output is this library's own design (Mermaid has none): swimlane columns with time running down. Colours follow the theme except the entity fills (see `docs/known-differences.md`).
