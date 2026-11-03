---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII `LR`/`RL` flowcharts, state and class diagrams no longer print an edge label over the edge's arrowhead. When a label slid sideways off a sibling edge's stem in a tight gap, it landed on the cell next to the target box, so `S1 -->|e1| S2` beside `S1 --> S3` drew `┬e1│ S2 │` with no head on `S2`. The head now stays and the label moves up a row (#1592).
