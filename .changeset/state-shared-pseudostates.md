---
'zombie-mermaid': patch
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/svg-renderer': patch
---

State diagrams (SVG and ASCII): every `[*]` in a scope (the top level, a composite, or a concurrent region) now shares one start node and one end node, like mermaid's `root_start` / `root_end`, instead of one node per `[*]`. Three or more concurrent regions in SVG now lay out two across in written order, wrapping the third under the first. Checked against mermaid@12.3.0.
