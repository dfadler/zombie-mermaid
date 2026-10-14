---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: at a narrow `paddingX` (1 or 2), an LR edge that bypasses a same-row child now starts with a `┬` junction in the gap after its parent, instead of dropping from beside the child's arrowhead. The gap before such a child is kept 3 wide, as #1404 did for fan-in children. Fixes [#1915](https://github.com/dfadler/zombie-mermaid/issues/1915).
