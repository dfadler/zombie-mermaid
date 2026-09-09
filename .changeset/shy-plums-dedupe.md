---
---

No release: `pages.ts` now bundles `demo/diagram-page-client.ts` via
`bundleForBrowser` (`scripts/vite-bundle.ts`) instead of calling
`esbuild.build()` directly, matching `editor.ts` (#310), and its duplicated
Shiki fence-line-stripping regex pair is now the shared
`stripShikiFenceLines` helper in `demo/format.ts` (#741). Pure refactor, no
change to `pages.ts`'s rendered output; demo/site-only, so there's no
consumer-facing change to describe for the published `zombie-mermaid`
package.
