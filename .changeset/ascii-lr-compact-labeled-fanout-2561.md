---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII `LR`/`RL` flowcharts no longer push a labelled node's branches far apart. A box with a labelled edge to the first of two children was moved into a slot of its own, opening about ten empty rows between the second-rank nodes (`S0 -->|e0| S1; S1 --> S2; S1 --> S3; S0 --> S4` drew three times as tall as mermaid). It now sits between its children, as mermaid draws it, and the label rides the horizontal run (#2561).
