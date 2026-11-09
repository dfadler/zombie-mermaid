---
'zombie-mermaid': minor
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
'@zombie-mermaid/mcp': patch
---

Radar charts. `radar-beta` diagrams now parse and render to SVG and ASCII/Unicode text, under the upstream-types umbrella ([#2085](https://github.com/dfadler/zombie-mermaid/issues/2085), [#2814](https://github.com/dfadler/zombie-mermaid/issues/2814)). `DiagramType` gains `'radar'` and `detectDiagramType` routes a `radar-beta` header to it (case-sensitively, as Mermaid's detector does). `@zombie-mermaid/mermaid-parser` adds `parseRadar` with the `Radar` and `PositionedRadar` types, a port of Mermaid's grammar and database: `axis` and `curve` lists with `["label"]`s, values written plain or as `axis: value` entries, the `showLegend`, `ticks`, `max`, `min` and `graticule` options, and Mermaid's errors (a missing entry for an axis, a newline inside an axis list, a keyword as an axis name). `@zombie-mermaid/svg-renderer` adds `layoutRadar` and `renderRadarSvg`: Mermaid's geometry (700 x 700 frame, circle and polygon graticules, bezier curves, the legend and the title). `pnpm run radar:oracle` compares the frame, rings, spokes, labels, curves, legend and title with real mermaid.js and agrees on every gallery sample and eight edge cases with mermaid 12.3.0, and the parser agrees with Mermaid's own on 87 sources. The ASCII output is this library's own design (Mermaid has none): a group of bars per axis on a ruler. Not read yet: `radar` config in `%%{init}%%` and the `radar` theme variables (see `docs/known-differences.md`).
