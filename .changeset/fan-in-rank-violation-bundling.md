---
'zombie-mermaid': patch
---

ASCII flowcharts: a fan-in/fan-out edge bundle now refuses to merge an edge whose source/target rank doesn't actually satisfy the geometric assumption edge bundling depends on (every source strictly before a shared target, or every target strictly after a shared source). Previously a "diamond" shape (e.g. `Queue --> Worker` alongside `Queue --> Retry --> Worker`) could leave two nodes at the same rank, causing their two distinct edges into a shared target to visually fuse into one shared arrowhead — silently swallowing one edge's own termination point.
