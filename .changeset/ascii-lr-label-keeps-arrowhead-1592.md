---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII `LR`/`RL` flowcharts, state and class diagrams now draw an edge label on its edge, as mermaid does, and no longer print it over the arrowhead. When a label did not fit on its run beside a sibling edge's stem, it slid to the row above, or landed on the cell next to the target box, so `S1 -->|e1| S2` beside `S1 --> S3` drew `┬e1│ S2 │` with no head on `S2`. The gap between the two nodes now widens until the label fits on the edge with a blank cell each side, so the same graph draws `┬─e1─►│ S2 │`. Some `LR` diagrams with labelled edges come out a few columns wider (#1592).
