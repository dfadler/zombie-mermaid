---
'zombie-mermaid': patch
---

Internal: the package build is now a single declarative Vite config (`vite.config.lib.ts`, built with `vite build --app`) instead of the imperative `scripts/build-lib.ts` script that drove six separate `vite build()` calls. Each public entry point is its own Vite environment, so nothing changes in the published output: every file under `dist/` is byte-identical to what the script produced (JS, source maps, `.d.ts`/`.d.cts`, and `cli.js`'s executable bit).
