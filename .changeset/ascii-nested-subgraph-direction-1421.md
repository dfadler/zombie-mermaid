---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: a `direction RL` or `direction BT` inside a subgraph is now honored (it was drawn as `LR`/`TD`). The subgraph's box is mirrored in place, relative to the direction around it; a subgraph with an edge crossing its boundary still inherits the parent's direction (closes #1421).
