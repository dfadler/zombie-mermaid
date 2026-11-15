---
'zombie-mermaid': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
---

Block diagram links ([#3105](https://github.com/dfadler/zombie-mermaid/issues/3105)). `a --> b`, `a --- b`, `a ==> b`, `a -.- b`, the `x` / `o` / `<` markers and `a -- "text" --> b` now parse and draw. `parseBlock` returns the links as `BlockDiagram.edges` (`BlockEdge`), and `layoutBlock` returns them as `PositionedBlockDiagram.edges` with Mermaid 12.3.0's path points, basis-curve path and label place. `pnpm run block:oracle` now also compares every link's path and label place with real mermaid.js. The ASCII output leaves room between cells for links and draws each as a line with an arrow head.
