---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: in top-down flowcharts and state diagrams, a node that fans out to several children is now centred over them, as in Mermaid, instead of sitting above the first child. Its edges leave from the middle rather than sideways and back down. It applies to acyclic graphs outside subgraphs, and the node stays put when a child has another parent or centring would widen unrelated branches.
