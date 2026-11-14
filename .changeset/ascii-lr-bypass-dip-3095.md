---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: in a left-to-right flow, the edge that skips a node (`A --> C` past `B`, with `A --> B --> C`) now leaves A's right face, runs along the border row on the side away from `B`, and rises (or drops) into C's left face, as mermaid@12.3.0 draws it, instead of running straight along the row.
