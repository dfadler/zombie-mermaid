/** @jsxRuntime automatic */
/**
 * Hydration entry point for diagrams/all.html (pages.ts) — zombie-
 * mermaid#1001. Mirrors `demo/diagram-hub-client.tsx`'s pattern exactly:
 * no live diagram to re-theme, so this bundle is just `hydrateRoot()` for
 * {@link DiagramAllApp} plus `<NavIsland>`'s own hydration, in one small
 * bundle.
 *
 * Imports {@link DiagramAllApp} from `./components/diagram-all-app.tsx`,
 * *not* `./components/diagram-page.tsx` — that second file imports
 * `react-dom/server` for its own SSR-only purposes, and importing from it
 * here would drag that whole dependency into this browser bundle for no
 * reason; see `diagram-all-app.tsx`'s header comment.
 */
import { createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import {
  DiagramAllApp,
  DIAGRAM_ALL_PROPS_ELEMENT_ID,
  DIAGRAM_ALL_ROOT_ID,
  type DiagramAllAppProps,
} from './components/diagram-all-app.tsx'
import { hydrateNav } from './nav-client.tsx'

function readProps(): DiagramAllAppProps {
  const propsEl = document.getElementById(DIAGRAM_ALL_PROPS_ELEMENT_ID)
  if (!propsEl?.textContent) {
    throw new Error(
      `diagram-all-client: no #${DIAGRAM_ALL_PROPS_ELEMENT_ID} element with JSON content found`,
    )
  }
  return JSON.parse(propsEl.textContent) as DiagramAllAppProps
}

function main(): void {
  const container = document.getElementById(DIAGRAM_ALL_ROOT_ID)
  if (!container) {
    throw new Error(
      `diagram-all-client: no #${DIAGRAM_ALL_ROOT_ID} element found to hydrate`,
    )
  }
  const props = readProps()
  hydrateRoot(container, createElement(DiagramAllApp, props))
  hydrateNav()
}

main()
