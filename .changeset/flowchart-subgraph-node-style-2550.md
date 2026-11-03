---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/core': patch
---

Flowchart SVG: `style` and `class` on a subgraph id now fill, stroke and dash its cluster (and `color` its title), as in Mermaid 12.3.0 (#2550). A node `style` now keeps `stroke-dasharray` and, on a plain rectangle, `rx`/`ry` (#2551). The `@{ shape: }` names still drawn as approximations are listed in docs/diagrams.md (#2552).
