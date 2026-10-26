---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: in a left-to-right flowchart, a decision node `{x}` split two ways now sends both branch edges out of its right face and into the left face of each child, as mermaid does, instead of out of its top and bottom faces (#2351).
