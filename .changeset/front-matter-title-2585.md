---
'@zombie-mermaid/core': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
---

Output change: a front matter `title:` is now drawn as in Mermaid 12.3.0 (#2585). Flowchart, state, class and ER get a 54px title band above the diagram (ASCII: a centred row); sequence, pie, xychart and quadrant use it as the chart title unless the diagram has its own `title`. C4 and architecture draw nothing, as in Mermaid.
