---
'@zombie-mermaid/svg-renderer': patch
---

A flowchart with subgraphs is now arranged the way mermaid.js arranges it. ELK laid a subgraph's contents out as a block before the nodes around it, so a node outside a subgraph could never sit beside one inside it. The whole graph is now laid out flat and each subgraph is drawn as a box around its members, with the other nodes kept clear of the box. In the CI/CD sample, `Deploy Staging`, `QA Approved?` and `Production` form a column beside the pipeline's box and `Fix & Retry` sits at its bottom, as in mermaid.js. Sibling subgraphs side by side are drawn in mermaid.js's order. Diagrams the new layout can't handle (a subgraph with its own direction, an edge to a subgraph, state diagrams) or can't fit keep the previous layout; architecture diagrams are unchanged. Exports `layoutFlowchartSync`.
