---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: with `paddingX` 1 or 2, an `LR` node with several parents no longer has one parent's edge stop beside its border with no junction or arrowhead; the gap before such a node is kept at least 3 wide so the edges join (fixes #1393).
