---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: with a layout provider, an unlabelled group of duplicate edges between two nodes that would put more ends on one face than its three cells hold (the `a --> b` and `b --> c` pairs of "Dense Duplicate Edges") now leaves and enters by the faces mermaid@12.3.0 uses (bottom/top in a vertical flow, right/left in a horizontal one), one stroke and arrowhead per edge, instead of spilling onto the side faces.
