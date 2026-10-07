---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

Scope every SVG `id` (arrowhead, class and sequence markers) and its `url(#…)` / `href="#…"` references with a per-render hash, so several diagrams inlined in one HTML document no longer share marker ids and lose their arrowheads when the first one is hidden (#1397).
