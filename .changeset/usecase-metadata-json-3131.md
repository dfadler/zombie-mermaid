---
'zombie-mermaid': minor
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
---

Use case diagrams read `@{ ... }` node metadata and `json` nodes, as mermaid@12.3.0 does. An actor takes `type: hollow|awesome` or `icon`, an actor or ellipse `business: true`, a `systemBoundary` `type: package`; `Name@{ ... }` on its own line sets them for a name declared elsewhere, and a body may span lines. `json Name @ { ... }` draws a key/value table that only `--`, `-->` and `<--` lines may join. `parseUsecase` returns `type`, `icon`, `business`, a boundary `type` and `jsonNodes`. ASCII draws the actor variants and the json table; it draws a package boundary and a business ellipse as plain frames and ellipses.
