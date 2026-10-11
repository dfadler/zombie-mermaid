---
'zombie-mermaid': patch
---

Lower the consumer Node floor from `>=24` back to `>=22.3.0` (the oldest LTS line) and declare the same `engines` on every `@zombie-mermaid/*` package. The library only needed `process.getBuiltinModule` (Node 22.3+); Node 24 stays the contributor toolchain via `devEngines`. See `docs/decisions/consumer-node-floor-1567.md` (#1567).
