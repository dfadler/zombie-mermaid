---
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/svg-renderer': patch
'zombie-mermaid': patch
---

State diagrams (SVG and ASCII): concurrent regions of unequal size now pack smallest first (ties in written order), and a bare state id inside a region declares that state instead of being dropped. Checked against mermaid@12.3.0.
