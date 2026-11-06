---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: ASCII xychart category labels are printed in full, as mermaid@12.3.0 does, instead of being cut with `…` (`Marke…`). Colliding word labels widen the bands until they no longer touch; numbers and dates are still thinned. Fixes #2698.
