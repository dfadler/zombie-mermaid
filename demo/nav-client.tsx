/** @jsxRuntime automatic */
/**
 * Hydrates `<Nav>` — the shared client-side entry point every page's Nav
 * hydration island (`demo/components/nav-island.tsx`'s `NavIsland`) mounts
 * against (zombie-mermaid#800).
 *
 * A plain exported function, not a top-level side-effecting `main()` call
 * (contrast `demo/dashboard-client.tsx`): `dashboard.html` already has its
 * own hydration entry (`dashboard-client.tsx`, hydrating `DashboardApp`
 * into `DASHBOARD_ROOT_ID`) and imports {@link hydrateNav} directly to also
 * hydrate its Nav, rather than shipping two separately-bundled scripts. The
 * other five page generators — which have no hydration entry point of
 * their own yet — bundle `demo/nav-only-client.tsx` instead, a two-line
 * entry that just calls this function; see that file's header comment.
 *
 * Imports {@link Nav} and the id constants from `nav.tsx` directly, *not*
 * from `nav-island.tsx` — that file imports `react-dom/server` for its own
 * SSR-only purposes, and importing from it here would drag that dependency
 * into every page's browser bundle for no reason (the exact hazard
 * `dashboard-app.tsx`'s header comment documents for the same split).
 */
import { createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import {
  NAV_PROPS_ELEMENT_ID,
  NAV_ROOT_ID,
  NAV_THEME_SLOT_ID,
  Nav,
  type NavProps,
} from './components/nav.tsx'

/**
 * The JSON-safe shape `demo/components/nav-island.tsx`'s `NavIsland`
 * embeds — duplicated here (rather than imported from that file) so this
 * client entry never has even a type-only edge to `nav-island.tsx`, which
 * imports `react-dom/server` for its own SSR-only purposes. See that
 * module's `NavHydrationProps` for the authoritative definition; keep the
 * two in sync.
 */
interface NavHydrationProps {
  active?: NavProps['active']
  hrefs?: NavProps['hrefs']
  homeHref?: NavProps['homeHref']
  installCommand?: NavProps['installCommand']
  sticky?: NavProps['sticky']
  label?: NavProps['label']
  className?: NavProps['className']
  hasInstallSlot?: boolean
}

function readNavProps(): NavProps {
  const propsEl = document.getElementById(NAV_PROPS_ELEMENT_ID)
  if (!propsEl?.textContent) {
    throw new Error(
      `nav-client: no #${NAV_PROPS_ELEMENT_ID} element with JSON content found`,
    )
  }
  const { hasInstallSlot, ...navProps } = JSON.parse(
    propsEl.textContent,
  ) as NavHydrationProps
  return {
    ...navProps,
    installSlot: hasInstallSlot
      ? createElement('div', { id: NAV_THEME_SLOT_ID })
      : undefined,
  }
}

/**
 * Hydrates the page's `<Nav>` island. Safe to call at most once per page
 * load — every generated page renders exactly one {@link NAV_ROOT_ID}
 * container.
 */
export function hydrateNav(): void {
  const container = document.getElementById(NAV_ROOT_ID)
  if (!container) {
    throw new Error(`nav-client: no #${NAV_ROOT_ID} element found to hydrate`)
  }
  hydrateRoot(container, createElement(Nav, readNavProps()))
}
