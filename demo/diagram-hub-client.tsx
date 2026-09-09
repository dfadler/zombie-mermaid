/** @jsxRuntime automatic */
/**
 * Hydration entry point for diagrams/index.html (pages.ts) —
 * zombie-mermaid#805, applying the #799/#800 hydration pattern
 * (`dashboard-client.tsx`) to the diagram-type hub. `pages.ts` bundles
 * this file via `scripts/vite-bundle.ts`'s `bundleForBrowser` and inlines
 * the result into a `<script type="module">`.
 *
 * Imports {@link DiagramHubApp} from `./components/diagram-hub-app.tsx`,
 * *not* `./components/diagram-page.tsx` — that second file imports
 * `react-dom/server` for its own SSR-only purposes, and importing from it
 * here would drag that whole dependency into this browser bundle for no
 * reason; see `diagram-hub-app.tsx`'s header comment.
 *
 * `<NavIsland>` hydrates here too, via {@link hydrateNav}, in the same
 * bundle — see `fork-fixes-client.tsx`'s identical header comment for why.
 * `ThemePicker`'s own hydration is unaffected by this issue: it's still
 * `demo/theme-bar-only-client.ts`'s `hydrateThemeBar()`, bundled
 * separately as this page's `themeBarScript` — the hub has no live diagram
 * to re-theme, so unlike `demo/diagram-type-client.tsx` it doesn't need
 * that heavier bundle.
 */
import { createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import {
  DiagramHubApp,
  DIAGRAM_HUB_PROPS_ELEMENT_ID,
  DIAGRAM_HUB_ROOT_ID,
  type DiagramHubAppProps,
} from './components/diagram-hub-app.tsx'
import { hydrateNav } from './nav-client.tsx'

function readProps(): DiagramHubAppProps {
  const propsEl = document.getElementById(DIAGRAM_HUB_PROPS_ELEMENT_ID)
  if (!propsEl?.textContent) {
    throw new Error(
      `diagram-hub-client: no #${DIAGRAM_HUB_PROPS_ELEMENT_ID} element with JSON content found`,
    )
  }
  return JSON.parse(propsEl.textContent) as DiagramHubAppProps
}

function main(): void {
  const container = document.getElementById(DIAGRAM_HUB_ROOT_ID)
  if (!container) {
    throw new Error(
      `diagram-hub-client: no #${DIAGRAM_HUB_ROOT_ID} element found to hydrate`,
    )
  }
  const props = readProps()
  hydrateRoot(container, createElement(DiagramHubApp, props))
  hydrateNav()
}

main()
