---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII with the ELK layout provider (the CLI and the root entry): two flowcharts that crashed now render. A subgraph whose member has a self-loop drawn past its nodes, with another edge running beside the frame, no longer runs out of memory (the frame-gutter widening chased a wall that moved with it). A subgraph with its own `direction` and a lane group between its members no longer throws `TypeError: Cannot read properties of undefined (reading 'start')`.
