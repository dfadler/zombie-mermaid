---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/mermaid-parser': patch
---

SVG: class and ER boxes are sized as mermaid@12.3.0 draws them: 24px member rows, a 48px class header (72 with an annotation), 24px compartment padding, 42.75px ER header and rows, a row with a `<br>` comment one line taller, and widths from mermaid's kerned 16px text measurement. `PositionedErEntity` gains `rowHeights`. Refs #2678.
