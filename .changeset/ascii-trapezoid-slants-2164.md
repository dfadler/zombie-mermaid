---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

Output change: ASCII trapezoids `[/x\]` and `[\x/]` now slant both sides like mermaid's (`╱ ╲` / `/ \`, one column per row) instead of vertical walls with slash corners, keep the wide edge at the bottom (top for `[\x/]`) in BT as mermaid does, and are wider by the slant (#2164).
