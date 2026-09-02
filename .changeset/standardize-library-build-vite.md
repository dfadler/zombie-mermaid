---
'zombie-mermaid': patch
---

Build the published package with Vite's library mode (`scripts/build-lib.ts`) instead of tsup, matching the dev server's earlier move to Vite (#307). No public API change: `dist/`'s file layout, dual ESM+CJS output, and `.d.ts`/`.d.cts` type declarations for both the `zombie-mermaid` and `zombie-mermaid/ascii` entry points are unchanged, and both were verified against a real `npm pack` install (ESM `import`, CJS `require`, and TypeScript under both `bundler` and `node16` module resolution).
