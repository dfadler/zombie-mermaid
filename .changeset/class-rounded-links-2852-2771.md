---
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
'@zombie-mermaid/mermaid-parser': patch
---

Output change: class diagram SVG edges round their bends as in Mermaid 12.3.0 (radius 5, drawn as `<path>` instead of `<polyline>`), and a plain `--` or `..` link now draws no arrowhead, in SVG and ASCII. `..` is now accepted, as a dashed link without a marker. The parser reports these as relationship types `link` and `dashed-link`.
