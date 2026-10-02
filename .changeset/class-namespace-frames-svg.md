---
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/mermaid-parser': patch
---

Class diagram SVG now draws `namespace Name { ... }` blocks as a titled frame around their member classes, as Mermaid does. Previously the blocks were parsed but never drawn. `PositionedClassDiagram` gains a `namespaces` array carrying each frame's geometry.
