---
'zombie-mermaid': patch
---

ASCII flowcharts: when a node fans out into two or more sibling subgraphs that are each fed by an edge from outside themselves (e.g. a load balancer routing into two regional subgraphs), the ASCII renderer now places the last-declared sibling subgraph leftmost, matching real mermaid.js's dagre-based cluster placement. Previously the ASCII grid layout placed siblings in edge-declaration order, which happened to equal source-declaration order for the common case and produced the opposite (and wrong) left-right arrangement.
