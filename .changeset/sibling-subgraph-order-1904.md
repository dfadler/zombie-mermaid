---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

Flowcharts: sibling subgraphs tied together by a shared outside node (`E --> A`, `E --> C`) now keep declaration order left to right, as mermaid 12 draws them. Unconnected siblings stay reversed. Nested Subgraphs horizontal agreement with mermaid 12.1.0 goes from 20% to 100%. Refs #1904.
