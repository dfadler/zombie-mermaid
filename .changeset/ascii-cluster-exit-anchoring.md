---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII flowcharts and state diagrams: when two or more edges leave a subgraph (or composite state) to differently-placed targets, they now all cross the cluster's own flow-side wall through one shared trunk and fan out below it, instead of some edges leaving through the side of the inner node that stands in for the cluster. Labels no longer overwrite the cluster border. Single-exit clusters render exactly as before. Closes #1135, #1148, #1156.
