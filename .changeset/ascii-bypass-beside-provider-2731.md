---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: with the ELK layout provider (the CLI, MCP and root entry), a forward edge that skips a node (`A --> N --> C` plus `A --> C`) now runs straight along the spine and the skipped node steps aside, with one port and one arrowhead per edge, as mermaid@12.3.0 draws it, instead of merging into the stem of the node it skips.
