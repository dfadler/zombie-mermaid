---
'zombie-mermaid': minor
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
'@zombie-mermaid/mcp': patch
---

Packet diagrams. `packet` and `packet-beta` diagrams now parse and render to SVG and ASCII/Unicode text, under the upstream-types umbrella ([#2085](https://github.com/dfadler/zombie-mermaid/issues/2085), [#2813](https://github.com/dfadler/zombie-mermaid/issues/2813)). The SVG matches `mermaid@12.3.0` element by element (bit ranges, `+N` counts, fields cut across rows, `title`, and the `rowHeight`, `bitWidth`, `bitsPerRow`, `paddingX`, `paddingY`, `showBits` and `bitOrder` config keys); the ASCII drawing is this library's own, since Mermaid has no text mode for packets. `DiagramType` gains `'packet'`.
