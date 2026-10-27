---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

Fix ASCII class diagrams where two lines arriving at a narrow class box put an arrowhead on a corner glyph of its top border; each line now lands on its own interior border cell and the lines no longer cross above the box.
