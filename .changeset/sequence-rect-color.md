---
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/svg-renderer': patch
'zombie-mermaid': patch
---

Sequence diagrams: `rect <color>` is now a background highlight, as in Mermaid. The SVG paints the block region with the colour and draws no frame or tab; a text that isn't a recognised colour is ignored. Previously the colour was treated as a block label, so the SVG and ASCII output printed `rect [rgb(255,0,0)]` and applied no colour. (#2239)
