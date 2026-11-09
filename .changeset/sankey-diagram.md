---
'zombie-mermaid': minor
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
'@zombie-mermaid/mcp': patch
---

Sankey diagrams. `sankey-beta` (and `sankey`) diagrams now parse and render to SVG and ASCII/Unicode text, under the upstream-types umbrella ([#2085](https://github.com/dfadler/zombie-mermaid/issues/2085), [#2816](https://github.com/dfadler/zombie-mermaid/issues/2816)). `DiagramType` gains `'sankey'`, `detectDiagramType` routes the header to it, and `%%{init: {"sankey": {...}}}%%` is read for `linkColor`, `nodeAlignment`, `showValues`, `prefix`, `suffix`, `labelStyle`, `width`, `height`, `nodeWidth`, `nodePadding` and `nodeColors` (`SankeyInitConfig`). `@zombie-mermaid/mermaid-parser` adds `parseSankey` with the `Sankey` and `Positioned*` types, a port of Mermaid's CSV grammar (quoted fields, printable-ASCII names, a cycle is "circular link"). `@zombie-mermaid/svg-renderer` adds `layoutSankey` and `renderSankeySvg`: d3-sankey's layout ported to TypeScript and Mermaid's drawing, which agree with mermaid 12.3.0 to 0.01px on the sample set. The ASCII output is this library's own design (Mermaid has none): each source with a bar per outgoing flow. Not done yet: a checked-in `sankey:oracle` script and Mermaid's HTML sanitising of node names (see `docs/known-differences.md`).
