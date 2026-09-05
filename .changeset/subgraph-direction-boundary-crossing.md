---
'zombie-mermaid': patch
---

ASCII flowcharts: a subgraph's own `direction` override (e.g. `direction LR` inside an outer `graph TD`) is now ignored whenever one of its member nodes has an edge to something outside the subgraph, matching real mermaid.js's documented behavior ("if any of a subgraph's nodes are linked to the outside, subgraph direction will be ignored — instead the subgraph will inherit the direction of the parent graph"). Previously the ASCII renderer applied a subgraph's direction override unconditionally.
