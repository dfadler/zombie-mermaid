---
---

No release: hydrates dashboard.html (dashboard.ts) with real React state
(zombie-mermaid#799) — the #797 hydration epic's proof-of-concept, run
first specifically because this page had zero client-side interactivity
to regress. Establishes the client-entry-point (`demo/dashboard-client.tsx`)
/ `bundleForBrowser` wiring / SSR-prop-serialization (`buildDashboardViewModel`
in `demo/dashboard-model.ts`) / `hydrateRoot()` pattern every later #797
sub-issue reuses, plus three real gotchas the pattern needs to handle:
`hydrateRoot`'s container must be inert and separate from the hydrated
component's own root; `renderToStaticMarkup` never emits the hydration
boundary comments `hydrateRoot` needs (fixed by using `renderToString` for
just the hydrated island, spliced in via `dangerouslySetInnerHTML`); and a
still-imperative sibling (`Nav`'s install-pill copy script, not hydrated
until #800) can't sit inside a hydrated subtree without mutating the DOM
out from under it. `DashboardApp` (the hydrated body content) now lives in
`demo/components/dashboard-app.tsx`, split out from `dashboard-page.tsx`
so the browser bundle never pulls in `react-dom/server`. Nothing here
touches the published `zombie-mermaid` package.
