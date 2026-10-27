---
'zombie-mermaid': patch
---

ASCII output for LR and RL flowcharts, state and class diagrams now leaves 4 blank rows between sibling nodes instead of 5 (`paddingY - 1`, so `-y 5` no longer gives the old gap; use `-y 6`). `graph LR; A --> B & C & D & E` is two rows shorter; TD is unchanged (#2350).
