---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII flowcharts and architecture diagrams: a cycle whose edges cross between sibling subgraphs (e.g. `A --> C --> E --> A` with each node in its own subgraph) no longer throws `Node "A" has no gridCoord`. Closes #1197.
Such a back-edge now routes outside the frames it only passes (instead of up through their interiors and titles). Frames are not tracked in the routing grid, so the edge's route reserves the unrelated frames' cells and the gap is widened to clear each frame wall.
