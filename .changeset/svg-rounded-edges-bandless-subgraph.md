---
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/core': patch
---

Output change: flowchart and state SVG edges are now `<path>` elements with rounded orthogonal corners (radius 5·√2 px, as mermaid 12.3.0 draws them) instead of `<polyline>`; an explicit `curve` other than `linear` is unchanged. A flowchart subgraph is drawn as mermaid 12.3.0 draws it: a centred regular-weight title along the top edge with no header band (state composites keep the band).
