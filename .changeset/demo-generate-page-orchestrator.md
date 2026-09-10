---
---

No release: adds `scripts/generate-page.ts`'s `generatePage()` build
orchestrator and switches all six site generators
(index.ts/editor.ts/dashboard.ts/fork-fixes.ts/pages.ts/blog.ts) onto it
(#937, part of the #931 umbrella; builds on #936's shared Document/Shell
module). Replaces each generator's own copy-pasted write epilogue —
resolve an output path under `siteOutDir()`, `mkdir` its parent directory,
`writeFile` the rendered HTML, `console.log('Written to <path> (<n> KB)')`
— with one shared function that also covers the one real variation that
already existed (a client bundle or stylesheet written to its own
`assets/*` file before the main page, rather than inlined into it).
Pure internal deepening: every one of the 30 files produced by
`SITE_OUT_DIR=<dir> tsx <generator>.ts` across all six generators is
byte-identical before and after. Deliberately does not also wrap each
generator's own `bundleXClient()` functions — see `generate-page.ts`'s
header comment for why. Demo-site build tooling only — nothing here
touches the published `zombie-mermaid` package or any `packages/*`
package.
