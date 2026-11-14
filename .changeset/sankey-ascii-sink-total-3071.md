---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

Sankey ASCII: a sink fed by several links now prints its total on a closing `name  total` row, as mermaid@12.3.0 draws it on the node (`Hosting 20`, `c 7`); before, the total appeared nowhere.
