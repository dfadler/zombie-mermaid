---
---

No release: hydrates index.html (zombie-mermaid#804), applying the
#799/#800/#801/#802/#803 SSR + hydrate pattern to the marketing homepage.
`demo/components/index-page.tsx` is now a thin shell — the hydrated body
content lives in the new `demo/components/index-app.tsx`'s two apps:
`IndexHeroApp` (headline, subhead, hero visual, CTAs) and `IndexMainApp`
(feature grid, CLI/MCP section, diagram gallery teaser, proof section,
blog teaser), hydrated by the new `demo/index-client.tsx`, which also
hydrates `<NavIsland>` in the same bundle (replacing the separate
`nav-only-client.tsx` bundle this page used before).

Two hydrated apps, not one: `ThemeShowcase` sits between the hero and the
feature grid in document order, and can never be part of either app — it
renders `ThemePickerIsland` (a `react-dom/server` importer) and calls
`renderMermaidSVG` for its live diagram, so it stays in `index-page.tsx`
as a plain sibling between the two apps, following the pattern the
dashboard double-hydration fix established. `ThemeShowcase`'s own client
wiring (`demo/index-page-client.ts` — theme re-rendering, site-chrome
re-theming, the one-way picker-into-nav relocation on scroll) is entirely
unchanged by this issue, still its own separate, unminified external
asset bundle.

Neither hydrated app takes props: every value they render is a fixed
marketing constant, not per-render data, so there is nothing to
serialize into a props script. The `SoftwareApplication` JSON-LD block
stays in `<head>`, untouched — no page's `<head>` is ever part of a
`hydrateRoot()` boundary anywhere in this codebase.

Verified: full test suite green (including a new
`__tests__/dom/index-hydration.test.ts` covering both apps' hydration and
Nav's copy button hydrating correctly alongside them with no
interference — sabotage-checked), golden-DOM fixture regenerated with
section order verified unchanged, and a real headless-browser render of
the built index.html with no hydration-related console errors (one
pre-existing, unrelated SVG attribute warning on the hand-drawn hero
graphic, present in the original source before this split) — the theme
showcase picker interactive. Measured cost: the new `index-client.tsx`
bundle is ~231 KB raw / ~69 KB gzip (react + react-dom/client + both
apps' code + Nav hydration), in line with the #797 epic's ~57.5 KB gzip
floor; confirmed via Rollup's own `moduleIds` that it resolves zero
`react-dom/server` modules and none of the core renderer (`src/index.ts`).

Nothing here touches the published `zombie-mermaid` package.
