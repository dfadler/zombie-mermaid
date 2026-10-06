---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: when two or more edges leave a subgraph, each now starts at its own tee on the frame's wall, nearest its target and in target order, instead of all sharing one exit cell. A wall too narrow to give every exit its own cell keeps the shared tee (#1182).
