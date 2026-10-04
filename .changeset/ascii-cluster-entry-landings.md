---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: edges addressed to one subgraph (`X --> Sub`, `Y --> Sub`) that used to merge into a single arrowhead on the frame's wall now each get an arrowhead of their own, spread along the wall, as mermaid draws them. Entries that already landed apart, and walls too narrow to separate them, are unchanged.
