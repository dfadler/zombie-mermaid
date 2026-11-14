---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

Output change, ASCII: the two labels of a vertical reciprocal pair on separate ports (`A -->|go| B` with `B -->|back| A`) now sit on the same middle row, each on the outer side of its own stroke, as mermaid@12.3.0 draws them at one height. Before, each label stood next to its own arrowhead, on different rows. A pair whose neighbouring strokes leave no room beside the stroke keeps the old placement. State: Basic State Diagram (`start` and `cancel`) is the sample that changes.
