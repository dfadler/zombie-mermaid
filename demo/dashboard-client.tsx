/** @jsxRuntime automatic */
/**
 * Hydration entry point for dashboard.html (dashboard.ts) — zombie-mermaid#799,
 * the #797 hydration epic's proof-of-concept. `dashboard.ts` bundles this
 * file via `scripts/vite-bundle.ts`'s `bundleForBrowser` and inlines the
 * result into a `<script type="module">` (see `dashboard.ts`'s
 * `bundleDashboardClient()` doc comment for why inlined rather than
 * written to `assets/` and referenced by `src`).
 *
 * Imports {@link DashboardApp} from `./components/dashboard-app.tsx`, *not*
 * `./components/dashboard-page.tsx` — that second file imports
 * `react-dom/server` for its own SSR-only purposes, and importing from it
 * here would drag that whole dependency (and its own real weight) into
 * this browser bundle for no reason; see `dashboard-app.tsx`'s header
 * comment for the measured impact of getting this wrong.
 *
 * The pattern, reused unchanged by every later #797 per-page sub-issue:
 *
 * 1. Read the server-embedded props back out of the DOM — a
 *    `<script type="application/json">` tag ({@link DASHBOARD_PROPS_ELEMENT_ID})
 *    the server rendered with the *exact* {@link DashboardViewModel} it used
 *    to produce the page, not a value recomputed here. This is what makes
 *    hydration byte-identical: the client tree renders from the same data
 *    the server already rendered, not a fresh (and possibly
 *    locale/timezone-divergent — see `dashboard-model.ts`'s
 *    `DashboardViewModel` doc comment) computation of its own.
 * 2. `hydrateRoot()` the same component ({@link DashboardApp}) against the
 *    same DOM node the server rendered it into
 *    ({@link DASHBOARD_ROOT_ID}) — not `createRoot()`, which would discard
 *    and replace the server-rendered markup instead of attaching to it.
 *
 * dashboard.html had no interactive elements as of #799 (see #797's audit
 * table) — hydrating it was still worth proving out there specifically
 * *because* there was nothing to regress if the pattern had a bug, per that
 * issue's own reasoning for picking this page first. #800 is the first
 * sub-issue to add real interactive behavior on top of this plumbing:
 * `<Nav>`'s install-copy button, hydrated as its own separate island via
 * {@link hydrateNav} — see that function's own doc comment
 * (`demo/nav-client.tsx`) for why it isn't folded into {@link DashboardApp}
 * itself. #801 (ThemeBar) and the editor rewrite still come later.
 */
import { createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import {
  DashboardApp,
  DASHBOARD_PROPS_ELEMENT_ID,
  DASHBOARD_ROOT_ID,
} from './components/dashboard-app.tsx'
import type { DashboardViewModel } from './dashboard-model.ts'
import { hydrateNav } from './nav-client.tsx'

function readViewModel(): DashboardViewModel {
  const propsEl = document.getElementById(DASHBOARD_PROPS_ELEMENT_ID)
  if (!propsEl?.textContent) {
    throw new Error(
      `dashboard-client: no #${DASHBOARD_PROPS_ELEMENT_ID} element with JSON content found`,
    )
  }
  return JSON.parse(propsEl.textContent) as DashboardViewModel
}

function main(): void {
  const container = document.getElementById(DASHBOARD_ROOT_ID)
  if (!container) {
    throw new Error(
      `dashboard-client: no #${DASHBOARD_ROOT_ID} element found to hydrate`,
    )
  }
  const viewModel = readViewModel()
  hydrateRoot(container, createElement(DashboardApp, { viewModel }))
  // Nav is its own, separate hydration island (zombie-mermaid#800) — see
  // DashboardApp's doc comment (dashboard-app.tsx) for why it still isn't
  // part of DASHBOARD_ROOT_ID's own boundary.
  hydrateNav()
}

main()
