/** @jsxRuntime automatic */
/**
 * Hydration entry point for fork-fixes.html (fork-fixes.ts) —
 * zombie-mermaid#802, applying the #799/#800 hydration pattern
 * (`dashboard-client.tsx`) to this page. `fork-fixes.ts` bundles this file
 * via `scripts/vite-bundle.ts`'s `bundleForBrowser` and inlines the result
 * into a `<script type="module">` (see `fork-fixes.ts`'s
 * `bundleForkFixesClient()` doc comment for why inlined rather than written
 * to `assets/` and referenced by `src`).
 *
 * Imports {@link ForkFixesApp} from `./components/fork-fixes-app.tsx`,
 * *not* `./components/fork-fixes-page.tsx` — that second file imports
 * `react-dom/server` for its own SSR-only purposes, and importing from it
 * here would drag that whole dependency into this browser bundle for no
 * reason; see `fork-fixes-app.tsx`'s header comment.
 *
 * The pattern, unchanged from `dashboard-client.tsx`:
 *
 * 1. Read the server-embedded props back out of the DOM — a
 *    `<script type="application/json">` tag ({@link
 *    FORK_FIXES_PROPS_ELEMENT_ID}) the server rendered with the *exact*
 *    {@link ForkFixesAppProps} it used to produce the page. `PanelContent`'s
 *    `ascii`/`svg` `html` strings and `symptomHtml`/`lookForHtml` are
 *    already plain, pre-rendered strings, so nothing here re-runs
 *    ascii-html.ts, shiki, or the real-terminal capture pipeline — see
 *    fork-fixes-app.tsx's header comment.
 * 2. `hydrateRoot()` the same component ({@link ForkFixesApp}) against the
 *    same DOM node the server rendered it into ({@link
 *    FORK_FIXES_ROOT_ID}) — not `createRoot()`, which would discard and
 *    replace the server-rendered markup instead of attaching to it.
 *
 * `<NavIsland>` hydrates here too, via {@link hydrateNav}, in the *same*
 * bundle rather than a separate `nav-only-client.tsx` bundle — this page
 * already ships one react/react-dom copy for `ForkFixesApp`'s own
 * hydration, and `demo/theme-bar-only-client.ts` (bundled separately,
 * unchanged by #802) ships a second for the theme picker; a third bundle
 * just for Nav would pay for react/react-dom a third time on this page for
 * no reason. Mirrors `dashboard-client.tsx`'s `main()` exactly.
 */
import { createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import {
  ForkFixesApp,
  FORK_FIXES_PROPS_ELEMENT_ID,
  FORK_FIXES_ROOT_ID,
  type ForkFixesAppProps,
} from './components/fork-fixes-app.tsx'
import { hydrateNav } from './nav-client.tsx'

function readProps(): ForkFixesAppProps {
  const propsEl = document.getElementById(FORK_FIXES_PROPS_ELEMENT_ID)
  if (!propsEl?.textContent) {
    throw new Error(
      `fork-fixes-client: no #${FORK_FIXES_PROPS_ELEMENT_ID} element with JSON content found`,
    )
  }
  return JSON.parse(propsEl.textContent) as ForkFixesAppProps
}

function main(): void {
  const container = document.getElementById(FORK_FIXES_ROOT_ID)
  if (!container) {
    throw new Error(
      `fork-fixes-client: no #${FORK_FIXES_ROOT_ID} element found to hydrate`,
    )
  }
  const props = readProps()
  hydrateRoot(container, createElement(ForkFixesApp, props))
  // Nav is its own, separate hydration island -- see this file's header
  // comment for why it's still hydrated from this same bundle rather than
  // a dedicated one.
  hydrateNav()
}

main()
