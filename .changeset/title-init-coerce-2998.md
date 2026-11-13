---
'zombie-mermaid': patch
'@zombie-mermaid/core': patch
'@zombie-mermaid/mermaid-parser': patch
---

Pie, gantt, timeline, quadrant, xychart and radar titles are sanitized like mermaid@12.3.0 (a literal `&amp;`, kept tags as text, `#65;` decoded), and numeric-string init values ("80") work as numbers in the timeline, kanban, sankey, class, er, quadrant, xychart and architecture blocks; timeline `disableMulticolor` follows truthiness.
