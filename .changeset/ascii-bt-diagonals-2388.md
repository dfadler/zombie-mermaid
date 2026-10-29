---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

Output change: in `graph BT` the ASCII hexagon, circle and diamond keep their diagonals leaning as in TD (`╱┴╲` over `╱   ╲` on top) instead of reversed, because the vertical flip now swaps `╱`/`╲` (`/`/`\` in the ASCII charset) (#2388).
