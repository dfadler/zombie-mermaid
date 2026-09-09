/** @jsxRuntime automatic */
/**
 * Hydration entry point for dashboard.html (dashboard.ts) — zombie-mermaid#799,
 * the #797 hydration epic's proof-of-concept. `dashboard.ts` bundles this
 * file via `scripts/vite-bundle.ts`'s `bundleForBrowser` and writes it to
 * `assets/dashboard-client.js`, referenced by `demo/components/
 * dashboard-page.tsx`'s `DashboardPage` as a `<script type="module" src=...>`
 * (see that component's `clientScriptSrc` prop).
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
 * dashboard.html has no interactive elements yet as of this issue (see
 * #797's audit table) — hydrating it is still worth proving out here
 * specifically *because* there's nothing to regress if the pattern has a
 * bug, per the issue's own reasoning for picking this page first. Later
 * sub-issues (#800 Nav, #801 ThemeBar, the editor rewrite) add the actual
 * interactive behavior this plumbing exists to support.
 */
import { createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import {
  DashboardApp,
  DASHBOARD_PROPS_ELEMENT_ID,
  DASHBOARD_ROOT_ID,
} from './components/dashboard-page.tsx'
import type { DashboardViewModel } from './dashboard-model.ts'

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
}

main()
