---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: four or more edges between two stacked nodes in a top-down (or bottom-up) ASCII diagram now take a port each on the facing faces, the same cell on both, with a jog out to a lane either side of the group and the label on its lane, as Mermaid draws them, instead of looping round the target's right face. Forward and back edges share one port order; a group with another edge on those faces, or in a subgraph, keeps its routing.
