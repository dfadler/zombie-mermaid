---
'zombie-mermaid': patch
---

Stop `mergeEdges` bundling from drawing an edge straight through the nodes it skips over.

Bundling replaces a routed edge with a shared trunk plus a straight branch to each endpoint. That substitution assumed the branch only ever spans the gap between two adjacent layers. When a fan-out reaches a target several layers down, the branch instead crosses every layer in between — and any node standing in its column got a line drawn through the middle of it.

In this diagram, `A --> C` was bundled with `A --> B`, which pinned its junction to the gap just below `A` and then dropped it in one unbroken run to `C`, straight through `B` and `F`:

```
flowchart TB
  A[PR push] --> B[CI workflows]
  A --> C[merge status bot]
  B --> F[workflow_run events]
  F --> C
```

A bundled branch is now checked against every node box before it is adopted; a branch that would collide keeps the layout engine's own routing, which already goes around the obstacles. If that leaves fewer than two branches in a bundle there is no trunk left to share, so the whole group stays as routed. The same check guards the fan-in pass, which could otherwise re-introduce the crossing on an edge the fan-out pass had just declined to bundle.

Bundles whose endpoints share a layer — the common fan-out and fan-in shapes — are unaffected and still merge into a single trunk.
