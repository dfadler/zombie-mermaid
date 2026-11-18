---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

Output change, ASCII: the `[*]` start, and the target of an edge out of the frame, of a state composite with concurrent regions now stands on the frame's middle cell, as mermaid@12.3.0 draws it, when that node is the only one in its rank (an independent state sharing the rank at a different midpoint, or an edge crossing the rank, keeps the previous placement). Before, with regions of unequal width the dot and the arrow into the frame sat over the gap between two region columns.
