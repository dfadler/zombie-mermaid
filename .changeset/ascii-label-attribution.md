---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: an edge label now reads as belonging to its own edge. A label on a corner shared by two shifted port runs is moved to the row its stroke is drawn on instead of the row between two strokes, and a label beside a vertical stroke slides along it to a row clear of other edges' strokes so it is not mistaken for theirs.
