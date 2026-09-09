---
---

No release: `packages/core`'s `package.json` moves `elkjs` from `dependencies` to `devDependencies`. `packages/core/src/types.ts` only ever `import type { ElkNode } from 'elkjs'` — a type-only import erased before bundling — so `core` never actually executes `elkjs` at runtime. The umbrella `zombie-mermaid` package's published output is unaffected (it bundles both packages into its own `dist/`, and `elkjs` still stays out of `dist/ascii.js`), but this keeps `core`'s own manifest honest for the point where it becomes independently installable. `src/__tests__/workspace-package-boundaries.test.ts` is extended to assert each workspace package's declared `dependencies` match its actual non-type-only imports, so this can't silently drift back.
