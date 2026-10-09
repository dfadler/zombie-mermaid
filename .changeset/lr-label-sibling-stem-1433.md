---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: in an LR flowchart, a label on a horizontal run no longer covers a sibling edge's stem leaving the same node, which left that edge without a visible path and two edges that share a drop into one node no longer print their labels on the same cell, which erased one of them (#1433).
