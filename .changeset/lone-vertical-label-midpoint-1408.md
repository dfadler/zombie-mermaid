---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII flowcharts: a labelled vertical edge that is the only edge on both of its nodes now puts its label on the gap midpoint, as mermaid.js does, instead of about a third of the way down. Edges that share a node with another edge keep their current label row. Refs #1408.
