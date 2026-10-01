---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII flowcharts: the second parallel edge between two nodes no longer draws a stray arrowhead and junction on the target's border. In top-down graphs it joins the first edge's approach to the target; in left-right graphs it runs under the nodes and enters the target's bottom face with its own arrowhead.
