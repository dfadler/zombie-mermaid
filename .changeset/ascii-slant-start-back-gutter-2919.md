---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: a back edge into a node's bottom face in a top-down or bottom-up flow (`Error --> Idle` beside a composite state) now enters by the gutter cell under that face and runs clear of the composite's wall, leaving the source's top face as mermaid@12.3.0 does, instead of looping round the source's right side.
