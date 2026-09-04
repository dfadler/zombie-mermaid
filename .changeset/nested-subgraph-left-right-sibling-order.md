---
'zombie-mermaid': patch
---

ASCII/SVG flowchart layout: sibling subgraphs at the same nesting level now order left-to-right the way real mermaid.js does — in _reversed_ declaration order (the last-declared sibling renders leftmost), not in raw edge-declaration order. Previously a fan-out parent's edges (e.g. a Load Balancer connecting into two region subgraphs) determined which sibling subgraph landed on the left, purely by which outgoing edge was declared first; mermaid.js's own layout instead orders sibling subgraphs independent of any connecting edges, based on the order its parser's `subGraphs` list is walked (backwards) when building the layout graph. Fixes issue #444.
