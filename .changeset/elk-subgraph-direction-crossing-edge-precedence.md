---
'zombie-mermaid': patch
---

SVG/ELK layout: a nested subgraph's own `direction` override is now dropped when any of its member nodes has an edge crossing the subgraph's boundary, inheriting the parent's direction instead — matching real mermaid.js's documented precedence rule ("If any of a subgraph's nodes are linked to the outside, subgraph direction will be ignored. Instead the subgraph will inherit the direction of the parent graph."). Previously the SVG path honored the override unconditionally regardless of crossing edges. Mirrors the equivalent ASCII-path fix from issue #445.
