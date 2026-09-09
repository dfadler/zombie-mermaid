---
---

No release: restores site-wide theme re-skinning for the demo's Nav,
Footer, and cards, not just rendered diagrams. Before the #590 redesign,
picking a theme reskinned the whole site via `demo/client.ts`'s
`applyTheme()`; the redesign replaced that chrome with a fixed, non-reactive
dark palette in `demo/components/tokens.tsx`, and the restored theme
selector (#684-#690) only ever drove diagram re-theming, leaving Nav/
Footer/cards static. A new `demo/site-chrome-theme.ts` (`applyThemeToSiteChrome()`)
derives tokens.tsx's eight surface/ink custom properties from a theme's
bg/fg pair via `color-mix()`, reusing `packages/core/src/theme.ts`'s own
`MIX` percentages, and is now wired into every page's theme-state
subscription (`demo/theme-bar-only-client.ts` for Home/Diagrams hub/Blog/
Fork Fixes/Dashboard, `demo/diagram-page-client.ts` for the per-diagram-type
SEO pages). The six named accents stay fixed by design (semantic, not
theme-driven). Also fixes three previously-static gradient backgrounds
(`index-page.tsx`, `dashboard-page.tsx`, `diagram-page.tsx`) that baked a
literal `#0d1120` mid-stop, which would have shown as a jarring dark band
against a light theme. Addresses #772. Nothing here touches the published
`zombie-mermaid` package — this is demo-site UI only.
