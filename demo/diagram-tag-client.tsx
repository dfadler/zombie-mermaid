/** @jsxRuntime automatic */
/**
 * Hydration entry point for every diagrams/tag/<slug>.html page
 * (zombie-mermaid#991) — mirrors `diagram-hub-client.tsx`'s pattern
 * exactly (no live diagram to re-theme, so a small bundle), reused
 * unchanged across every generated tag page the same way `demo/diagram-
 * detail-client.tsx` is reused across every sample page.
 *
 * Imports {@link DiagramTagApp} from `./components/diagram-tag-app.tsx`,
 * *not* `./components/diagram-page.tsx` — that second file imports
 * `react-dom/server` for its own SSR-only purposes; see `diagram-hub-
 * client.tsx`'s identical header comment.
 */
import { createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import {
  DiagramTagApp,
  DIAGRAM_TAG_PROPS_ELEMENT_ID,
  DIAGRAM_TAG_ROOT_ID,
  type DiagramTagAppProps,
} from './components/diagram-tag-app.tsx'
import { hydrateNav } from './nav-client.tsx'

function readProps(): DiagramTagAppProps {
  const propsEl = document.getElementById(DIAGRAM_TAG_PROPS_ELEMENT_ID)
  if (!propsEl?.textContent) {
    throw new Error(
      `diagram-tag-client: no #${DIAGRAM_TAG_PROPS_ELEMENT_ID} element with JSON content found`,
    )
  }
  return JSON.parse(propsEl.textContent) as DiagramTagAppProps
}

function main(): void {
  const container = document.getElementById(DIAGRAM_TAG_ROOT_ID)
  if (!container) {
    throw new Error(
      `diagram-tag-client: no #${DIAGRAM_TAG_ROOT_ID} element found to hydrate`,
    )
  }
  const props = readProps()
  hydrateRoot(container, createElement(DiagramTagApp, props))
  hydrateNav()
}

main()
