---
'zombie-mermaid': patch
---

ASCII diagrams: edge label placement now measures a candidate path segment's real drawing-space width instead of summing raw grid-column widths, and requires strictly more room than the label's own length. Grid columns are centered rather than edge-to-edge, so summing column widths overstated how much space was actually available — a short approach segment could clear the length check on paper while having no real room, causing a label to render starting exactly on the node's own border cell and erase it.
