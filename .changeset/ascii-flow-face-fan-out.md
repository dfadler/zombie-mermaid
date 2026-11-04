---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: a top-down fan-out in ASCII now leaves the source's bottom face and drops into each target's top face, as Mermaid draws it, instead of leaving the side faces. Each edge gets its own stem (edges of different line styles never share one) and its label sits on its own drop. Reciprocal pairs, subgraph members and LR layouts keep their routing.
