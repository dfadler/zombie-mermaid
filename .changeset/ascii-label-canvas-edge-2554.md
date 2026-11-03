---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII flowcharts and state diagrams no longer cut an edge label at the canvas edge. A label centred on a stroke in the outermost column (an `RL` state diagram's `S4-->S0 : e1`) printed as `└1` with its first character off the canvas; the canvas now grows to hold the whole label (#2554).
