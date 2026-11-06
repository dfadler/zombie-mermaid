---
'@zombie-mermaid/core': patch
'@zombie-mermaid/ascii-renderer': patch
'@zombie-mermaid/svg-renderer': patch
---

Output change: an ASCII xychart with a flat value series (every value equal, e.g. `bar [42]` or `bar [0, 0, 0]`) now draws the value axis as one tick at that value, as mermaid@12.3.0 and the SVG renderer do, instead of a `±0.1` ladder of two-decimal ticks. Fixes #2727.
