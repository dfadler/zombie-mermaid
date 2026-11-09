---
'zombie-mermaid': minor
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
'@zombie-mermaid/mcp': patch
---

Kanban boards. `kanban` diagrams now parse and render to SVG and ASCII/Unicode text, under the upstream-types umbrella ([#2085](https://github.com/dfadler/zombie-mermaid/issues/2085), [#2811](https://github.com/dfadler/zombie-mermaid/issues/2811)). `DiagramType` gains `'kanban'`, `detectDiagramType` routes a `kanban` header to it (case-sensitively, as Mermaid's detector does) and `kanban.sectionWidth` / `kanban.ticketBaseUrl` are read from front matter and `%%{init}%%`. `@zombie-mermaid/mermaid-parser` adds `parseKanban` with the `Kanban` and `Positioned*` types, a port of Mermaid 12.3.0's jison lexer, grammar and database: columns and cards by indentation, `id[text]`, `@{ ticket, assigned, priority, label, icon }` metadata in flow or block style, `::icon()` / `:::class` lines and Mermaid's errors ("Items without section detected", lowercase `shape`). `@zombie-mermaid/svg-renderer` adds `layoutKanban` and `renderKanbanSvg`: Mermaid's geometry (205px column pitch, 185px cards, 175px text, priority bars, ticket links), with line breaks found by summing Trebuchet MS advances and modelling Chrome's `break-spaces`, hyphen and CJK breaks. `pnpm run kanban:oracle` compares every column, card, priority bar and the drawing size with real mermaid.js and agrees on all gallery samples with mermaid 12.3.0. The ASCII output is this library's own design (Mermaid has none): stacked column blocks of boxed cards. Colours follow the theme (see `docs/known-differences.md`).
