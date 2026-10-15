---
'@zombie-mermaid/svg-renderer': patch
---

Flowchart SVG: an edge that crosses a subgraph border into a node that layer alignment moves up (the `Reply` and `Cache` targets in "Edges Into and Out of Subgraphs") no longer runs along that node's top border and ends in a half-clipped arrowhead. The cross-flow run now keeps room above the node, so the edge drops in with a whole arrowhead as in mermaid.js. The same shortened last or first leg is fixed in "CI/CD Pipeline", "Git Branching Workflow" and "Decision Self-Loop with Duplicate Edges". Fixes [#2110](https://github.com/dfadler/zombie-mermaid/issues/2110).
