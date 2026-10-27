---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: in a left-to-right flowchart, a decision node `{x}` with three or more outgoing edges now sends all of them out of its right face, as mermaid does, instead of its outer branches leaving the top and bottom tips (#2366).
