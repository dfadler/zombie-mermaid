---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: an ASCII flowchart edge that skips one node (`A --> B --> C` plus `A --> C`, unlabeled, paddingX 3+ and paddingY 2+ in TD) now steps the skipped node aside as in Mermaid 12.3.0: `B` sits above (LR) or to the right (TD) of the row or column, `A --> C` runs straight, and each of the three edges leaves and enters the flow faces with its own arrowhead instead of merging into one stem or running under the row into C's bottom face.
