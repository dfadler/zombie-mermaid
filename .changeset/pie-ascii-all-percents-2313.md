---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII pie: every legend row now shows its percentage, including slices that get no bar cell (under 1%, or past the bar's 50-cell budget); a nonzero share that rounds to 0% reads `<1%` (#2313).
