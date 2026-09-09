---
---

No release: hydrates the per-diagram-type SEO pages and their hub page
(zombie-mermaid#805), replacing `demo/diagram-page-client.ts` with
`demo/diagram-type-client.tsx` (type pages) and adding `demo/diagram-hub-
client.tsx` (the hub). `demo/components/diagram-page.tsx` is now a thin
shell for both `DiagramTypePage`/`DiagramHubPage` — the hydrated content
lives in the new `demo/components/diagram-type-app.tsx`'s `DiagramTypeApp`
(breadcrumb, header, "Source → render" panels, "More examples" gallery,
"Keep exploring" cross-links) and `demo/components/diagram-hub-app.tsx`'s
`DiagramHubApp` (page header + every type row).

This is the trickiest per-page migration in the #797 epic: unlike every
other page, the type-detail template has real client-side behavior beyond
Nav's copy button — swapping the rendered `<svg>`'s CSS custom properties
on a theme-pill click, re-theming the page chrome, and updating the "Open
in the live editor" link. That re-theming logic is deliberately **kept as
plain, imperative DOM mutation** (moved into `demo/diagram-type-client.tsx`
verbatim, not rewritten as React state) — converting it to state-driven
re-rendering would regress the "no re-render, since renderMermaidSVG's
output is already parameterized entirely by --bg/--fg" performance
property the original file's header comment documents as a deliberate
design choice, for a page whose own issue text calls out bundle-size
sensitivity as a real, still-relevant concern.

Combining a `hydrateRoot()`-hydrated tree with immediate imperative
mutation of the same DOM nodes surfaced a real, worth-recording bug during
development: `react-dom/client`'s `hydrateRoot()` schedules its hydration-
match verification asynchronously rather than fully synchronously, so a
synchronous re-theme call placed directly after it raced ahead of that
deferred check and produced a spurious "attributes didn't match" console
warning — even though the server-rendered markup and hydrated props were
identical. Fixed by wrapping the hydration calls in `react-dom`'s
`flushSync()`, which forces hydration to fully settle before any later
code (the re-theme calls) runs — confirmed via `__tests__/demo-diagram-
page-client.test.ts`'s existing "returning visitor" scenarios, which
reproduced the warning without the fix and are clean with it.

`ThemePickerIsland`/`<NavIsland>`/`<Footer>` stay plain siblings of each
hydration container, following the pattern the dashboard double-hydration
fix established. `sourcePanelHtml`/`diagramHtml`/gallery-item `diagramHtml`
(shiki/`renderMermaidSVG` output) round-trip through the serialized
hydration props as plain strings — no re-render of either pipeline in the
browser, and both `DiagramTypeApp` prop shapes (`OrientationVariants` as
a plain string, and as a `{wide, narrow}` pair) are covered.

Verified: full test suite green (including a new `__tests__/dom/diagram-
type-hydration.test.ts` covering both orientation shapes and the hub, plus
`__tests__/demo-diagram-page-client.test.ts` updated and sabotage-checked
for the re-theming behavior itself), golden-DOM fixtures regenerated, and
a real headless-browser render of a built type page and the hub with no
console errors — clicking a theme pill re-themes the SVG, updates the
editor-link href, and marks the pill active, exactly as before. Measured
cost: `diagram-type-client.tsx`'s bundle (react + react-dom/client +
`DiagramTypeApp` + Nav + theme-bar hydration + the re-theming logic) is
~214.5 KB raw / ~66.3 KB gzip; `diagram-hub-client.tsx`'s is ~204.3 KB raw
/ ~63.1 KB gzip — both confirmed via Rollup's own `moduleIds` to resolve
zero `react-dom/server` modules, in line with the #797 epic's ~57.5 KB
gzip react/react-dom floor.

Nothing here touches the published `zombie-mermaid` package.
