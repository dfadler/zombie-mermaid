---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: nodes are now ranked by longest path, as mermaid (dagre) does. A node reachable from several parents sits below the deepest one instead of beside the first parent that placed it, so `A --> B --> D` plus `A --> D` no longer puts D in B's row; back edges are ignored when ranking, and a child is no longer placed left of its parent when slots on its level are empty.
