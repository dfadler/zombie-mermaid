---
---

No release: hydrates `fork-fixes.html` (zombie-mermaid#802), applying the
#799/#800/#801 SSR + hydrate pattern to the last remaining fully-static
page in that set. `demo/components/fork-fixes-page.tsx`'s `ForkFixesPage`
is now a thin shell — the hero header and the fixes list live in the new
`demo/components/fork-fixes-app.tsx`'s `ForkFixesApp`, hydrated by the new
`demo/fork-fixes-client.tsx` via `hydrateRoot()`, mirroring
`dashboard-page.tsx`/`dashboard-app.tsx`/`dashboard-client.tsx` exactly.

`<NavIsland>`/`<ThemePickerSection>`/`<Footer>` stay plain siblings of the
hydration container (never nested inside `ForkFixesApp`'s tree) — the
pattern the dashboard double-hydration fix (see the earlier "stop nesting
ThemePickerSection..." changeset) established as the one every page must
follow. `fork-fixes-client.tsx` also hydrates `<NavIsland>` (via
`hydrateNav()`) in the same bundle as `ForkFixesApp`, replacing the
separate `nav-only-client.tsx` bundle this page used before — one fewer
copy of `react`/`react-dom` shipped on this page.

`PanelContent`'s `ascii`/`svg` `html` strings and `symptomHtml`/
`lookForHtml` round-trip through the serialized hydration props as plain
strings — no shiki/ascii-html.ts/real-terminal re-render happens in the
browser.

Verified: full test suite green (including a new
`__tests__/dom/fork-fixes-hydration.test.ts`, sabotage-checked, proving
clean hydration with no console warnings/errors and that Nav's copy
button works via real interaction on this specific page), golden-DOM
fixture regenerated, and a real headless-browser render of the built
`fork-fixes.html` with no console errors — the theme picker and Nav both
interactive. Measured cost: the new combined `fork-fixes-client.tsx`
bundle (`ForkFixesApp` + Nav hydration) is ~64 KB gzip, in line with the
#797 epic's ~57.5 KB gzip react/react-dom floor; confirmed via Rollup's own
`moduleIds` that it resolves zero `react-dom/server` modules.

Nothing here touches the published `zombie-mermaid` package.
