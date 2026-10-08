---
'zombie-mermaid': patch
'@zombie-mermaid/core': patch
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
'@zombie-mermaid/mcp': patch
---

Smaller tarballs: stop publishing `src/` (source maps already embed it via `sourcesContent`), and drop unused `entities` (mcp, root) and `elkjs` (root) dependency declarations (refs #1426).
