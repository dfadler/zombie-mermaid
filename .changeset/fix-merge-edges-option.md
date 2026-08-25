---
'zombie-mermaid': patch
---

Fix `mergeEdges` render option being silently ignored — `layoutGraphSync` always used the default value instead of the caller-supplied one, so passing `{ mergeEdges: false }` had no effect. Also documents `mergeEdges` on `RenderOptions` (it was implemented but never exposed in the public type).
