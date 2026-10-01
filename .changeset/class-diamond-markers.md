---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

Fix class-diagram composition (`*--`) and aggregation (`o--`) markers being hidden in SVG output. The diamond markers were anchored at the wrong end (`refX="0"`), so the whole diamond sat under the class box; they now put the tip on the line's endpoint like the inheritance triangle.
