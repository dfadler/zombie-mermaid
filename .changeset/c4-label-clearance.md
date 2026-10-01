---
'@zombie-mermaid/svg-renderer': patch
---

C4 SVG relationship labels no longer sit on a shape. Mermaid starts a label at the middle of its line, which lands on a neighbouring shape (the Database cylinder in the Container sample) when a line is short or passes through another shape; the label now slides along its line to the nearest spot clear of every shape and of other labels. A label that already clears everything stays where Mermaid puts it.
