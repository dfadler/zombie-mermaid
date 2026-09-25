---
'@zombie-mermaid/mermaid-parser': major
---

Removed `mixHexColors` from `@zombie-mermaid/mermaid-parser`'s public exports. It was a dead duplicate of `@zombie-mermaid/core`'s `mixHexColors` (different argument order/scale, same job) with zero callers anywhere in this repo, including its own module. If you were importing `mixHexColors` from `@zombie-mermaid/mermaid-parser`, use `@zombie-mermaid/core`'s `mixHexColors(fg, bg, pct)` instead (note: percentage 0-100, not ratio 0-1, and argument order is reversed).
