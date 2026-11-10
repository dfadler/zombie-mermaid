---
'zombie-mermaid': patch
---

`--layout mermaid` / `renderMermaidASCIIWithLayout` now draw every parallel edge, as mermaid@12.3.0 does, instead of merging identical ones into a single line. A node with many edges on one face grows taller or wider to give each edge its own row or column.
