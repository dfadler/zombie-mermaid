---
'zombie-mermaid': patch
---

Ship a CommonJS build alongside the existing ESM build so `require('zombie-mermaid')` — and any bundler that resolves dependencies in CJS mode — works instead of throwing `ERR_PACKAGE_PATH_NOT_EXPORTED`. `tsup` now builds both `dist/index.js` (ESM) and `dist/index.cjs` (CJS), each with its own type declarations (`dist/index.d.ts` / `dist/index.d.cts`). The `exports["."]` map now has separate `import` and `require` conditions, each with its own nested `types`/`default`, and the legacy `main` field now points at the CJS build (previously ESM) so non-`exports`-aware resolvers get a working fallback instead of a broken one.
