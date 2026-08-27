---
'zombie-mermaid': patch
---

Unify ASCII edge routing between regular and bundled (fan-in/fan-out) edges. Both now route through the same `routeEdge` logic: an unobstructed direct L-shaped path is tried before falling back to A* search. Previously only regular edges got this direct-path fast path, so bundled edges could take an unnecessarily zigzagged A*-search route even when a straight, unobstructed path was available. Bundled edges may now render with a more direct (and still non-crossing) path than before.
