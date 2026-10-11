---
'@zombie-mermaid/svg-renderer': patch
'zombie-mermaid': patch
---

Fix SVG rendering of graph diagrams inside a browser Web Worker: hiding the worker-style `self` while constructing ELK no longer throws "Cannot set property self ... which has only a getter" (#1524).
