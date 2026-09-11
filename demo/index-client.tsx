/** @jsxRuntime automatic */
/**
 * Hydration entry point for index.html (index.ts) — zombie-mermaid#804,
 * applying the #799/#800 hydration pattern (`dashboard-client.tsx`) to the
 * homepage. `index.ts` bundles this file via `scripts/vite-bundle.ts`'s
 * `bundleForBrowser` and inlines the result into a `<script
 * type="module">`.
 *
 * Imports {@link IndexHeroApp}/{@link IndexMainApp} from
 * `./components/index-app.tsx`, *not* `./components/index-page.tsx` —
 * that second file imports `react-dom/server` for its own SSR-only
 * purposes, and importing from it here would drag that whole dependency
 * into this browser bundle for no reason; see `index-app.tsx`'s header
 * comment.
 *
 * Two separate `hydrateRoot()` calls, not one — {@link IndexHeroApp} and
 * {@link IndexMainApp} are two separate hydration islands (see `index-
 * app.tsx`'s header comment for why `ThemeShowcase` has to sit between
 * them, unhydrated by either), so this mirrors calling `hydrateRoot()`
 * once per island the same way `dashboard-client.tsx` calls it once for
 * `DashboardApp` and once (via {@link hydrateNav}) for `<Nav>`.
 * `IndexMainApp` takes no props, so it hydrates directly; `IndexHeroApp`
 * needs its real `asciiHtml` prop read back from
 * `#index-hero-props`' `<script type="application/json">` element first
 * (via {@link readIndexHeroAppProps}) — the same
 * `diagram-type-app.tsx`/`demo/diagram-type-client.tsx` pattern, see
 * `index-app.tsx`'s header comment for why.
 *
 * `<NavIsland>` hydrates here too, via {@link hydrateNav}, in the same
 * bundle rather than a separate `nav-only-client.tsx` bundle — see
 * `fork-fixes-client.tsx`'s identical header comment for why.
 * `ThemeShowcase`'s own client wiring (`demo/index-page-client.ts`, a
 * separate, unchanged bundle) is untouched by this file.
 */
import { createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import {
  IndexHeroApp,
  IndexMainApp,
  INDEX_HERO_ROOT_ID,
  INDEX_HERO_PROPS_ELEMENT_ID,
  INDEX_MAIN_ROOT_ID,
  type IndexHeroAppProps,
} from './components/index-app.tsx'
import { hydrateNav } from './nav-client.tsx'

function hydrateContainer(
  id: string,
  node: ReturnType<typeof createElement>,
): void {
  const container = document.getElementById(id)
  if (!container) {
    throw new Error(`index-client: no #${id} element found to hydrate`)
  }
  hydrateRoot(container, node)
}

function readIndexHeroAppProps(): IndexHeroAppProps {
  const propsEl = document.getElementById(INDEX_HERO_PROPS_ELEMENT_ID)
  if (!propsEl?.textContent) {
    throw new Error(
      `index-client: no #${INDEX_HERO_PROPS_ELEMENT_ID} element with JSON content found`,
    )
  }
  return JSON.parse(propsEl.textContent) as IndexHeroAppProps
}

function main(): void {
  hydrateContainer(
    INDEX_HERO_ROOT_ID,
    createElement(IndexHeroApp, readIndexHeroAppProps()),
  )
  hydrateContainer(INDEX_MAIN_ROOT_ID, createElement(IndexMainApp))
  hydrateNav()
}

main()
