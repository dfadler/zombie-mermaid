---
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/core': patch
---

Output change: SVG state diagrams draw mermaid@12.3.0's barbed `stateDiagram-barbEnd-margin` arrowheads (the edge stops 5.5px short of the box so the tip sits 3.5px clear of it) and state boxes with a 5px corner radius instead of 6. `MermaidGraph` and `PositionedGraph` gain an optional `stateDiagram` flag. Drop shadows are not matched (visual effect, out of scope per #2617).
