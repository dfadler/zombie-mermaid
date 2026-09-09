---
---

No release: converts `editor/js/*.js` (the live editor's client-side code)
from 18 plain, `var`-scoped scripts concatenated in a hand-maintained fixed
order (`editor.ts`'s old `readJsFiles()`) into real TypeScript modules with
explicit `import`/`export` statements. `editor.ts` now bundles
`editor/js/index.ts` through the same Vite `build()` API it already uses
for `src/browser.ts`, with tree-shaking disabled so the bundle keeps every
module's side effects exactly as the old concatenation did. `editor/js/`
is now linted and type-checked (`editor/tsconfig.json`, added to
`pnpm run typecheck`) the same way the rest of the site tooling already is.

Two pieces of state that used to cross file boundaries as an implicit
shared global (`cfgFont`/`cfgPadding`, `diagramThemeIsAuto`) needed a real
owner module once ES module bindings made "some other file reassigns my
variable" impossible; `updateThemeButton()` moved into its own
`editor/js/theme-button.ts` module so `dark-mode.ts` and `init.ts` no
longer import each other (a real circular import that a bundler's
topological evaluation order resolved differently than the old hand-order
array did — a genuine bug caught during this conversion, not a
theoretical one). No behavior change otherwise: `editor/__tests__/`'s full
suite passes unchanged (its harness now bundles the real
`editor/js/index.ts` graph via the same `bundleForBrowser()` call
`editor.ts` uses, instead of duplicating the old file-order array), and
`editor/__tests__/module-load-order.test.ts` — which existed only to check
that hand-order array — is removed; the import graph is now what `tsc`
verifies instead. Closes #766, following up on #744. Nothing here touches
the published `zombie-mermaid` package.
