---
---

No release: hydrates `<Nav>`'s install-copy button as a real React component
(zombie-mermaid#800), widened in scope per repo-owner decision to also stand
up a minimal `hydrateRoot()` entry point on every page that had none yet —
`editor.html`, `index.html`, `fork-fixes.html`, every `blog/*.html`, and
every `diagrams/*.html` — reusing #799's proven SSR+hydrate pattern. Only
`dashboard.html` already had an entry point (from #799); it now also
hydrates Nav via the same shared client (`demo/nav-client.tsx`'s
`hydrateNav()`), alongside `DashboardApp`.

Replaces `NAV_COPY_SCRIPT`'s `dangerouslySetInnerHTML` script with a real
`onClick`/`onKeyDown` handler and `useState`-driven "copied" flash on
`NavInstall` (`demo/components/nav.tsx`) — same visual behavior, same
1200ms flash, same clipboard-API guard, but no more runtime DOM mutation
after the fact. `demo/components/nav-island.tsx`'s `NavIsland` is the new
shared server-side helper every page-level generator renders in place of a
bare `<Nav .../>`: a `renderToString`-rendered `#nav-root` container plus a
`#nav-props` JSON payload, mirroring `dashboard-app.tsx`'s
`DASHBOARD_ROOT_ID`/`DASHBOARD_PROPS_ELEMENT_ID` pattern. `demo/nav-only-
client.tsx` (bundled via `demo/build-nav-client.ts`) is the minimal entry
point the five newly-hydrated pages ship; `primitives.tsx`'s `Pill` gained
optional `role`/`tabIndex`/`aria-label`/`onClick`/`onKeyDown` props so
`NavInstall` can reuse it instead of duplicating its styles.

Measured cost: ~60.8 KB gzip per newly-hydrated page (react + react-dom/
client + Nav, minified) — dashboard.html's combined bundle (DashboardApp +
Nav) grows from #799's 63.5 KB gzip to ~65.5 KB gzip. Nothing here touches
the published `zombie-mermaid` package.
