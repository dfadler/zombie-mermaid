---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: parallel edges between two nodes are drawn as separate strokes in more cases. A lane no longer doubles back along its own row (a stray `+`, or node text overwritten); three or four edges between two decisions in a horizontal flow take a row each of the facing vertex (reciprocal first, as mermaid draws them) however tall the decision is; and four edges between two boxes that all run from the later-declared node grow the face instead of losing two edges.
