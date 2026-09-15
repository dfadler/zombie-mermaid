---
---

No release: fixes `packages/site/fork-fixes.ts`'s before/after demo-site
generator so a fix living inside a `@zombie-mermaid/*` workspace package
(not just the umbrella `src/`) archives and renders its "before" state
correctly. Internal build tooling only — no published package's runtime
behavior changes.
