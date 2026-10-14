---
'@zombie-mermaid/svg-renderer': patch
---

Output change: in an SVG flowchart without subgraphs, a sink node reached by a labeled edge now sits beside its siblings instead of one layer below them, as mermaid.js (12.1.0 and 12.2.0) draws it. The "Decision Tree" sample is the example. ASCII output is unchanged. Fixes [#1750](https://github.com/dfadler/zombie-mermaid/issues/1750).
