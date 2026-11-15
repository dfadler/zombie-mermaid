---
'zombie-mermaid': patch
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/ascii-renderer': patch
---

Use case diagrams: `parseUsecase` reads `<<stereotype>>` and `:::class` suffixes, `classDef` / `class` / `style`, circle and cross markers (`--o`, `--x`, `o--`, `x--`), `id@` edge ids with `id@{ animate: true }`, and markdown strings, as mermaid@12.3.0 does (#3131). ASCII: a dotted connector that meets a solid edge's tee now draws a crossing instead of an arm with no arm back, and a dotted edge into a node's side face no longer runs up and overwrites the node's wall (#3132).
