# Site generators migrate to React page-by-page, static markup only

Status: implemented

## Decision

Decision (as of #589):

- The page generators (#423) migrate to React one page at a time, static markup only (`renderToStaticMarkup`, no hydration).
- Order: `dashboard.ts` (done), `editor.ts` (prototype in #423, finished in #589), `index.ts`, `fork-fixes.ts`, `pages.ts`, `blog.ts`, then `demo/client.ts` as a separate, later decision.
- All page generators render through `renderToStaticMarkup` as of #589; `demo/site-shell.ts`, the repo-root `theme-picker.ts` and `editor/html/*.html` are gone.
- As of #589, `demo/client.ts` remained a separately bundled vanilla script, its migration out of scope and undecided. A later decision removed it: see [site-generators-react-migration.md](site-generators-react-migration.md).
- The editor's flex-layout hazard is asserted by `__tests__/editor-page.test.ts`.

Full write-up: https://github.com/dfadler/zombie-mermaid/issues/423#issuecomment-6884746697
