---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/core': patch
---

gitGraph: the `redux`, `redux-dark`, `redux-color`, `redux-dark-color`, `neo` and `neo-dark` themes and `look: neo` now size and draw the graph as mermaid@12.3.0 does (smaller commits, square 32px label boxes, 12 branch colours, Arial text widths, the neo drop shadow); `look` is read from `%%{init}%%` and front matter. In ASCII, `parallelCommits: true` puts commits of the same depth on one row when their lanes do not overlap.
