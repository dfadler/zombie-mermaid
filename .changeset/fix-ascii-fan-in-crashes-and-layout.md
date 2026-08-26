---
'zombie-mermaid': patch
---

Fix several bugs in the ASCII/Unicode renderer's edge-routing and root-detection engine (#64):

- **Crash**: dense fan-in/fan-out graphs could exhaust the heap during edge routing. A* pathfinding is now bounded by a render-wide iteration budget (not just a per-call cap), and unobstructed edges take a direct route without invoking A* at all.
- **Crash**: root detection used a single order-dependent forward pass over the parsed nodes, which could misclassify a node as a root when a `child --> parent` edge appeared in the source after a `parent --> grandchild` edge — leading to `Map maximum size exceeded` on some graphs. Root detection is now a two-pass, order-independent algorithm (collect every edge target, then anything never targeted is a root), with a fallback seed node for graphs that are entirely a cycle (no node is ever a true root).
- Fan-in root nodes are now grouped by their shared downstream target before grid placement, so e.g. `A1, A2 --> A` and `B1, B2 --> B` are placed contiguously instead of interleaved.
- Sibling edges from the same source now share a straight trunk instead of one taking an unnecessary zigzag detour, by preferring an unobstructed direct route over an equal-length A\* zigzag.
- The box-start connector (`├`/`┤`/`┬`/`┴`) no longer drifts off the source node's border when a sibling edge's label widens a shared grid column.
