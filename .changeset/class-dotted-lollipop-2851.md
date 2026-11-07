---
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
---

Class diagrams accept the dotted lollipops `()..`, `..()` and `()..()`, which were a parse error: they draw the same circle as `()--` on a dashed stem, in SVG and ASCII, as Mermaid 12.3.0 does.
