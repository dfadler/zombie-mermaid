---
'zombie-mermaid': patch
---

Consolidate the four-call CSS composition (`designBaseCss()`, `primitivesCss()`, `navCss()`, `footerCss()`, in that cascade-required order) that blog.ts, dashboard.ts, fork-fixes.ts, `DiagramTypePage`/`DiagramHubPage`, and `IndexPage` each repeated behind a new `demo/components/shared-page-css.tsx` module (`sharedPageCss()` for the `.ts` generators, `<SharedPageStyles/>` for the React pages), replacing the ordering comment restated at each call site with one comment on the helper itself. Internal refactor only — every generated page's output is byte-for-byte unchanged. Closes #751.
