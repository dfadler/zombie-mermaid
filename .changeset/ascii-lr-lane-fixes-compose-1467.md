---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: LR labeled fan-in edges no longer leave their source from the box corner or cross another label's lane; the pathfinder lane-avoidance that conflicted with the split-lane routing is removed, so each label keeps its own lane (#1467).
