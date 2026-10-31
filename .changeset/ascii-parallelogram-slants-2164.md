---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

Output change: ASCII parallelograms `[/x/]` and `[\x\]` now lean both sides like mermaid's (`╱` / `╲`, `/` / `\`, one column per row) instead of vertical walls with slash corners, keep their lean in BT and RL as mermaid does, and are wider by the slant (#2164).
