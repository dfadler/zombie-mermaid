---
'zombie-mermaid': patch
---

Fix nested-subgraph `direction` overrides being silently ignored, and edges crossing subgraph boundaries failing to route cleanly (falling back to a naive Z-path or failing to route at all). Cross-boundary edges are now decomposed into a chain of sub-edges joined at explicit ELK ports, one hop per boundary crossed, so ELK can route each hop correctly within its own container level. `mergeEdges` trunk-bundling still works for edges that go through this decomposition.
