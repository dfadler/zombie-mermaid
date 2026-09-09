---
---

No release: fixes doc/comment references to the pre-#590 "samples showcase" behavior that `index.ts` no longer has — it now generates the marketing home page (`demo/components/index-page.tsx`), not a sample browser. Updated `vite.config.ts`'s route comment, `CONTRIBUTING.md`'s `pnpm run dev`/`pnpm run samples` descriptions, and `samples-data.ts`'s header (which listed `index.ts` as a consumer; it no longer imports that file — its real consumers are the Playwright visual-regression suite, `scripts/visual-diff.ts`, `demo/diagram-pages-data.ts`, `bench.ts`, and `vite.config.ts`). No functional change; the `samples` script name in `package.json` is left as-is pending a separate decision on renaming it.
