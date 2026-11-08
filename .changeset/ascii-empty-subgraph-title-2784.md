---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: an empty flowchart subgraph's title is centred on its neighbour's column, as in Mermaid 12.3.0, and as an endpoint of a top-down or bottom-up edge it is bare text on the edge line (the arrowhead on the row above, the edge leaving below), not a boxed node. Left-to-right edge endpoints were already bare text. Refs #2784.
