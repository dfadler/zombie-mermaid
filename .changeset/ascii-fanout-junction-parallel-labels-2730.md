---
'@zombie-mermaid/ascii-renderer': patch
---

Output change (ASCII flowcharts, as in mermaid@12.3.0): a fan-out stem now tees into its source box (`┬` / `├`) like a single edge does (#2730), and three labelled parallel edges whose labels are too wide to sit beside their strokes leave the source's bottom face and enter the target's top face, with the labels on one row, instead of entering the target's side faces (#2736).
