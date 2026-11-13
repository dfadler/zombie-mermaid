---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

Pie SVG: on a light background slices use mermaid@12.3.0's default `pie1`..`pie12` scale (`#ECECFF`, `#ffffde`, `hsl(80, 100%, 56.27%)`, ...) instead of the theme-accent blue/teal scale; dark backgrounds keep the theme-derived scale.
