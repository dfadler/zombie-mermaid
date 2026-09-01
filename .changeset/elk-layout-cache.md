---
'zombie-mermaid': minor
---

Added an opt-in layout cache for ELK-based layout (flowchart, state, class, and ER diagrams). Create one with `createLayoutCache()` and pass it via `RenderOptions.layoutCache` (or directly to `elkLayoutSync()`) to skip re-running ELK layout on repeated renders of the same diagram + options — a bounded LRU (default 20 entries) keyed on a deterministic serialization of the fully-resolved ELK input graph, so different inputs can never collide on a cached result. Off by default; existing callers see no behavior change.
