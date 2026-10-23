---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

Output change: ASCII LR/RL flowcharts now centre a fan-out parent over its children, as TD already did and as mermaid draws it, instead of putting the parent on the first child's row with the rest stacked below. LR graphs with subgraphs keep the old layout for now.
