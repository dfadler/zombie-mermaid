/** @jsxRuntime automatic */
/**
 * Hydration entry point for every diagrams/<type>/<sample>.html page
 * (zombie-mermaid#989) — applying the #799/#800 hydration pattern
 * (`dashboard-client.tsx`) to the specific-diagram detail page, the same
 * way `diagram-hub-client.tsx` applies it to the hub. `pages.ts` bundles
 * this file once via `scripts/vite-bundle.ts`'s `bundleForBrowser` and
 * reuses the *same* built script across every generated sample page — see
 * `diagram-page.tsx`'s `DiagramDetailPageProps.clientScriptSrc` doc
 * comment for why that's an external, cacheable asset rather than inlined
 * per page.
 *
 * Imports {@link DiagramDetailApp} from `./components/diagram-detail-
 * app.tsx`, *not* `./components/diagram-page.tsx` — that second file
 * imports `react-dom/server` for its own SSR-only purposes, and importing
 * from it here would drag that whole dependency into this browser bundle
 * for no reason; see `diagram-hub-client.tsx`'s identical header comment.
 *
 * `<NavIsland>` hydrates here too, via {@link hydrateNav}, in the same
 * bundle — the {@link DiagramDetailApp} tree's own SVG/ASCII toggle
 * (`DetailOutputPanel`) is genuinely interactive local `useState` (unlike
 * the hub page's), so this hydration is not just architectural uniformity
 * here — the toggle needs it to work at all.
 */
import { createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import {
  DiagramDetailApp,
  DIAGRAM_DETAIL_PROPS_ELEMENT_ID,
  DIAGRAM_DETAIL_ROOT_ID,
  type DiagramDetailAppProps,
} from './components/diagram-detail-app.tsx'
import { hydrateNav } from './nav-client.tsx'

function readProps(): DiagramDetailAppProps {
  const propsEl = document.getElementById(DIAGRAM_DETAIL_PROPS_ELEMENT_ID)
  if (!propsEl?.textContent) {
    throw new Error(
      `diagram-detail-client: no #${DIAGRAM_DETAIL_PROPS_ELEMENT_ID} element with JSON content found`,
    )
  }
  return JSON.parse(propsEl.textContent) as DiagramDetailAppProps
}

function main(): void {
  const container = document.getElementById(DIAGRAM_DETAIL_ROOT_ID)
  if (!container) {
    throw new Error(
      `diagram-detail-client: no #${DIAGRAM_DETAIL_ROOT_ID} element found to hydrate`,
    )
  }
  const props = readProps()
  hydrateRoot(container, createElement(DiagramDetailApp, props))
  hydrateNav()
}

main()
