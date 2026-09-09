---
---

No release: site generators (`index.ts`, `editor.ts`, `fork-fixes.ts`,
`pages.ts`, `blog.ts`, `dashboard.ts`) now write directly to `SITE_OUT_DIR`
(defaulting to their own directory, i.e. repo root, unchanged for
`pnpm run dev` and the standalone per-page scripts) instead of always writing
to repo root and having `build:site` `mv` the output into `site/` afterward.
`build:site` now sets `SITE_OUT_DIR=site` and no longer runs any `mv` step.
Verified the resulting `site/` tree is byte-for-byte identical to the old
mv-chain output. Demo-site build tooling only — nothing here touches the
published `zombie-mermaid` package or its runtime behavior.
