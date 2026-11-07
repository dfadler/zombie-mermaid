---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: in an LR flowchart where one edge skips a node (`A --> B --> C` plus `A --> C`), the skipped node `B` now sits 2 of 5 text rows off `A` and `C`, as in Mermaid 12.2.0 and 12.3.0 (0.46 node heights), instead of 4 rows.
