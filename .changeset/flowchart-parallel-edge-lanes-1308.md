---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

Flowchart: edges leaving a node are no longer merged onto one trunk when another edge (such as a return edge) ends on the same side of that node, so the git branching sample's branches and its `approved` arrow stay distinct.
