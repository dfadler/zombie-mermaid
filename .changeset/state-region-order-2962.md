---
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
'zombie-mermaid': patch
---

State diagrams (SVG and ASCII): concurrent regions of unequal size now pack smallest first (ties in written order), and a bare state id inside a region declares that state instead of being dropped. In ASCII, the edges into and out of a composite with regions now attach to its frame instead of a member inside a region. Checked against mermaid@12.3.0.
