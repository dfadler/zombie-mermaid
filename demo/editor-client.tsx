/** @jsxRuntime automatic */
/**
 * Hydration entry point for editor.html (editor.ts) — zombie-mermaid#806,
 * applying the #799/#800 hydration pattern (`dashboard-client.tsx`) to the
 * live editor's chrome. `editor.ts` bundles this file via `scripts/vite-
 * bundle.ts`'s `bundleForBrowser` (`bundleEditorAppClient()`) and inlines
 * the result into its own `<script type="module">` — a separate tag from
 * `scriptJs`/`navClientScript`, never concatenated with either; see
 * `editor-page.tsx`'s `EditorPageProps.editorClientScript` doc comment for
 * why.
 *
 * Imports {@link EditorApp} from `./components/editor-app.tsx`, *not*
 * `./components/editor-page.tsx` — that second file imports `react-dom/
 * server` for its own SSR-only purposes, and importing from it here would
 * drag that whole dependency into this browser bundle for no reason; see
 * `editor-app.tsx`'s header comment.
 *
 * Deliberately does **not** import or call anything from `editor/js/*.ts`
 * — that whole module graph is bundled and run completely separately (see
 * `editor.ts`'s `bundleEditorJs()`), reading the DOM this file's own
 * `hydrateRoot()` call hydrates (not creates) via plain `getElementById()`
 * lookups, same as it always has.
 *
 * **Script order matters here, unlike every other #797 page's client
 * entry.** `editor-page.tsx` places this script's tag *before* the
 * `scriptJs` tag that carries `editor/js/*.ts` — both are `type="module"`
 * (executing in document order relative to each other, like `defer`), and
 * `editor/js/init.ts`'s own top-level code synchronously mutates DOM
 * nodes inside {@link EDITOR_ROOT_ID} the moment it runs (`
 * updateLineNumbers()` sets `#line-numbers`'s `textContent`, for one). If
 * that ran before hydration here, React's own hydration-match
 * verification — itself asynchronous, not fully synchronous, even though
 * `hydrateRoot()` returns immediately — would find `#line-numbers`
 * already containing text it never rendered and fail with a real
 * hydration-mismatch error. Caught for real in a browser during #806's
 * development, not by reasoning alone. `flushSync()` below closes the
 * other half of the race: it forces this call's hydration to fully
 * settle before `main()` (and this whole script) returns, so even though
 * script tags already run in order, nothing about `hydrateRoot()`'s own
 * async completion can let `editor/js`'s later-running code find
 * mid-hydration state.
 *
 * `<NavIsland>` is *not* hydrated from here — it keeps its own existing,
 * separate `nav-only-client.tsx` bundle (`navClientScript`), unchanged by
 * this issue. (Every other #797 page consolidated Nav's hydration into its
 * own client entry; this page's script-tag concatenation constraints —
 * documented on `EditorPageProps.navClientScript` — make that
 * consolidation a bigger change than #806's own foundational scope calls
 * for, so it's left for a later editor sub-issue if ever worth doing.)
 */
import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { hydrateRoot } from 'react-dom/client'
import {
  EditorApp,
  EDITOR_PROPS_ELEMENT_ID,
  EDITOR_ROOT_ID,
  type EditorAppProps,
} from './components/editor-app.tsx'

function readProps(): EditorAppProps {
  const propsEl = document.getElementById(EDITOR_PROPS_ELEMENT_ID)
  if (!propsEl?.textContent) {
    throw new Error(
      `editor-client: no #${EDITOR_PROPS_ELEMENT_ID} element with JSON content found`,
    )
  }
  return JSON.parse(propsEl.textContent) as EditorAppProps
}

function main(): void {
  const container = document.getElementById(EDITOR_ROOT_ID)
  if (!container) {
    throw new Error(
      `editor-client: no #${EDITOR_ROOT_ID} element found to hydrate`,
    )
  }
  const props = readProps()
  flushSync(() => {
    hydrateRoot(container, createElement(EditorApp, props))
  })
}

main()
