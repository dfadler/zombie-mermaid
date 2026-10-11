---
'zombie-mermaid': minor
---

SVG: a flowchart subgraph that no edge crosses now lays out perpendicular to its parent (a row inside `graph TD`, a column inside `graph LR`), as mermaid.js does, unless it sets its own `direction`. A `direction` inside a subgraph is now honored when the only edges touching the subgraph go to or from its id, and ignored when an edge crosses the boundary. Two unconnected sibling subgraphs also stack perpendicular to the flow. ASCII output is unchanged for now (#1699).
