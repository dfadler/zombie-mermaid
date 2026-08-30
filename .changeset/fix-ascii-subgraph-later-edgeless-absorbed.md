---
'zombie-mermaid': patch
---

ASCII backend: a subgraph with no edges of its own no longer gets absorbed into an earlier subgraph's frame with its title dropped. This happened only when the earlier subgraph had at least one edge-less member and the later subgraph carried no anchoring edge at all — the earlier subgraph's edge-less node was deferred to a slot next to its own subgraph (per the #90/#143 fix), but found that slot via a subgraph-agnostic blind slide that could walk straight through the later subgraph's already-placed root, landing on its far side and ballooning the earlier subgraph's bounding box to enclose it. Deferred nodes now attach to their own subgraph's root immediately, before any other subgraph's root can claim the adjacent slot. Fixes #301.
