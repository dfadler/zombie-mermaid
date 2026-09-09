---
'zombie-mermaid': patch
---

Internal refactor: `runRender` (`src/cli/render.ts`) now resolves each output format's stdout-vs-file-vs-skip routing through a single shared `resolveTarget`/`emit` pair instead of re-implementing the same three-way branch separately for ascii/svg/html/png. No behavior change — same target resolution and output for every existing flag combination. Closes #743.
