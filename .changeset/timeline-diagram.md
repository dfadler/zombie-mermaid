---
'zombie-mermaid': minor
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
'@zombie-mermaid/mcp': patch
---

Timelines. `timeline` and `timeline TD` diagrams now parse and render to SVG and ASCII/Unicode text, under the upstream-types umbrella ([#2085](https://github.com/dfadler/zombie-mermaid/issues/2085), [#2845](https://github.com/dfadler/zombie-mermaid/issues/2845)). `DiagramType` gains `'timeline'` and `detectDiagramType` routes a `timeline` header to it (case-sensitively, as Mermaid's detector does). `@zombie-mermaid/mermaid-parser` adds `parseTimeline` with the `Timeline` and `Positioned*` types, a port of Mermaid's lexer and database: `title`, `section`, periods with `: event` parts and continuation lines, `%%` comments, a `#` comment even inside a period, and an event before any period as a parse error. `@zombie-mermaid/svg-renderer` adds `layoutTimeline` and `renderTimelineSvg`: Mermaid's geometry for both directions, with line breaks found by summing Trebuchet MS advances. `pnpm run timeline:oracle` compares every box, wrapped line, dashed line and the drawing size with real mermaid.js and agrees on all gallery samples with mermaid 12.3.0 (12.2.0 renders them identically). The ASCII output is this library's own design (Mermaid has none): a vertical spine of periods and events. Not read yet: `timeline` config in `%%{init}%%` and the `neo`/`redux` looks (see `docs/known-differences.md`).
