---
'zombie-mermaid': minor
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
'@zombie-mermaid/mcp': patch
---

Block diagrams. `block` and `block-beta` diagrams now parse and render to SVG and ASCII/Unicode text, under the upstream-types umbrella ([#2085](https://github.com/dfadler/zombie-mermaid/issues/2085), [#2805](https://github.com/dfadler/zombie-mermaid/issues/2805)). `DiagramType` gains `'block'` and `detectDiagramType` routes a `block` / `block-beta` header to it (case-sensitively, as Mermaid's detector does). `@zombie-mermaid/mermaid-parser` adds `parseBlock` with the `BlockDiagram`, `BlockNode` and `PositionedBlockDiagram` types, a port of Mermaid 12.3.0's lexer and database for `columns`, blocks (`id`, `id["text"]`, `id("text")`), `id:N` spans, `space`, and `block:id ... end` groups. `@zombie-mermaid/svg-renderer` adds `layoutBlock` and `renderBlockSvg`: Mermaid's grid layout, with label widths found by summing Trebuchet MS advances. `pnpm run block:oracle` compares every block, corner radius and the drawing size with real mermaid.js and agrees on all gallery samples with mermaid 12.3.0. The ASCII output is this library's own design (Mermaid has none): a grid of boxed cells with groups as larger boxes. Links, the other shapes and styling are rejected with an error naming a tracking issue ([#3105](https://github.com/dfadler/zombie-mermaid/issues/3105), [#3106](https://github.com/dfadler/zombie-mermaid/issues/3106), [#3107](https://github.com/dfadler/zombie-mermaid/issues/3107)). Colours follow the theme (see `docs/known-differences.md`).
