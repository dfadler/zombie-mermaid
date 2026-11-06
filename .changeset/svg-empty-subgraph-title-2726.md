---
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/core': patch
---

Output change: an empty flowchart subgraph is drawn in SVG as its title only, with no frame, like mermaid@12.3.0 (a zero-height cluster). Refs #2726.
