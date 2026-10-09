---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: in a top-down flowchart, when three sibling edges leave a cluster for the same target, the third now enters the target's side face one row below the second instead of merging into its stroke, so each label's edge can be followed to its own arrowhead. The two-sibling layout is unchanged (closes #1331).
