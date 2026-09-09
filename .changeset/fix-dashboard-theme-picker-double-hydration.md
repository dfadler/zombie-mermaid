---
---

No release: fixes a dashboard.html bug found while investigating
zombie-mermaid#802, before it ever reached `main` (#801/PR833 was still
open). `demo/components/dashboard-app.tsx`'s `DashboardApp` nested
`<ThemePickerSection>` (and `<Footer>`) directly inside its own hydrated
tree. Since #801 changed `ThemePickerSection` to render via
`ThemePickerIsland` — which imports `react-dom/server` for its own
SSR-only purposes — that nesting leaked `react-dom/server` into
`dashboard-client.tsx`'s browser bundle (violating this file's own
"never touches react-dom/server" invariant) and would have hydrated
`#theme-pills` twice over: once via `DashboardApp`'s own `hydrateRoot()`
call and again via `demo/theme-bar-client.tsx`'s `hydrateThemeBar()`
(bundled separately for every page that mounts `ThemePickerSection`).

Fixed by moving `<ThemePickerSection>` and `<Footer>` out of `DashboardApp`
and into `dashboard-page.tsx` itself, as plain siblings of the
`DASHBOARD_ROOT_ID` hydration container (same visual position, inside the
same `dc-root` wrapper) — matching how every other page mounts
`ThemePickerSection` (top-level page JSX, no hydrated ancestor) and how
`<Nav>` is already kept a sibling island rather than nested.

Verified: the actual built `dashboard-client.tsx` bundle resolves zero
`react-dom/server` modules (checked via Rollup's own `moduleIds`, not a
source-level import grep — new `__tests__/dashboard-client-bundle.test.ts`),
`#theme-pills` never appears inside `DashboardApp`'s hydrated subtree and
only one hydration call ever targets it (new tests in
`__tests__/dom/dashboard-hydration.test.ts`), and a real browser render
(headless Chrome against the built `dashboard.html`) hydrates cleanly with
no console warnings/errors and the theme picker stays fully interactive.

Nothing here touches the published `zombie-mermaid` package.
