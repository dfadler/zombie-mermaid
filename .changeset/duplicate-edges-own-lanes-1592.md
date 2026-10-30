---
'@zombie-mermaid/svg-renderer': patch
'zombie-mermaid': patch
---

Flowchart edges repeated between the same two nodes (four `a --> b`, say) now keep a lane each instead of being merged onto one path by `mergeEdges`, matching mermaid.js, which draws one path per edge.
