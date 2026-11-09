---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII flowchart: a decision with a parallel edge pair plus a third branch (`A{Aaa} --> B`, `A --> B`, `A --> C`) in TD and BT now leaves the diamond's vertex on three separate cells, with no merged bus, as mermaid does. LR already matched. Checked against mermaid@12.3.0.
