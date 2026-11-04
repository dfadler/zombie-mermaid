---
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/mermaid-parser': patch
---

Output change: `architecture-beta` SVG now lays services out on Mermaid's grid instead of through ELK, so a service named by a `B`/`T`/`L`/`R` port sits exactly one cell beyond its neighbour (a replica under a junction no longer slides into the next column) and every link on the grid is one straight run. Groups are drawn as Mermaid draws them: a dashed unfilled box with the icon tile in the top-left corner and the title beside it, no header band, with Mermaid's padding. Architecture diagrams no longer need `elkjs`.
