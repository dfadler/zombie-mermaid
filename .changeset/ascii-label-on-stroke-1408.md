---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: a vertical edge's label is drawn on its stroke at the gap midpoint, centred on the line the way Mermaid does, with the stroke carrying on above and below the text. A gap too short for that, or cells already taken, keep the previous placement (refs #1408, option C).
