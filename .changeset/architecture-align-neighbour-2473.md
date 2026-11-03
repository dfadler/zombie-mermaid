---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

SVG architecture diagrams line a service up with the upper of its neighbours in the layer before, instead of letting it float between them. In the Group-To-Group Edges sample `db` now sits level with `jobs`, as in Mermaid. Against mermaid 12.2.0 that sample goes from 67% to 100% vertical placement agreement; Nested Groups And Junction is unchanged (#2473).
