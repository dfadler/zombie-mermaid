---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: edge routing no longer floods the grid with A* iterations when an edge target is sealed off (e.g. by a style-conflict reroute's temporary block); the search now fails immediately. Output is unchanged (#1474).
