---
'@zombie-mermaid/ascii-renderer': patch
---

Fix `renderMermaidASCII` throwing "Grid block already occupied" for a node with a duplicated edge to one child plus another child (`A --> B`, `A --> B`, `A --> C`), in every direction.
