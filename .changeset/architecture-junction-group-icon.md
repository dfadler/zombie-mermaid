---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/core': patch
'@zombie-mermaid/ascii-renderer': patch
---

Architecture SVG: a `junction` is now a join with no gray disc and no gap in the edge, and a group's icon (`group api(server)[API]`) is drawn in its header, as in mermaid 12.2.0 and 12.3.0 (#2563, #2564). ASCII output is unchanged.
