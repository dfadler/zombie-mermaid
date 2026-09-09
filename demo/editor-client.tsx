/** @jsxRuntime automatic */
/**
 * Hydration entry point for editor.html (editor.ts) — zombie-mermaid#806,
 * applying the #799/#800/#802 hydration pattern (`dashboard-client.tsx`,
 * `fork-fixes-client.tsx`) to the live editor's own chrome.
 * `editor.ts` bundles this file via `scripts/vite-bundle.ts`'s
 * `bundleForBrowser` and inlines the result into a `<script type="module">`
 * (see `editor.ts`'s `bundleEditorClient()` doc comment).
 *
 * Imports {@link EditorApp} from `./components/editor-app.tsx`, *not*
 * `./components/editor-app-island.tsx` — that second file imports
 * `react-dom/server` for its own SSR-only purposes, and importing from it
 * here would drag that dependency into this browser bundle for no reason
 * (the exact hazard `dashboard-app.tsx`'s header comment documents for the
 * identical split).
 *
 * The hydration pattern itself, unchanged from `dashboard-client.tsx`/
 * `fork-fixes-client.tsx`:
 *
 * 1. Read the server-embedded props back out of the DOM — a
 *    `<script type="application/json">` tag ({@link
 *    EDITOR_PROPS_ELEMENT_ID}) the server rendered with the *exact*
 *    {@link EditorAppProps} it used to produce the page.
 * 2. `hydrateRoot()` the same component ({@link EditorApp}) against the
 *    same DOM node the server rendered it into ({@link EDITOR_ROOT_ID}) —
 *    not `createRoot()`, which would discard and replace the
 *    server-rendered markup instead of attaching to it.
 *
 * ## Loading the legacy `editor/js/*.ts` bundle
 *
 * `editor.ts`'s legacy `editor/js/*.ts` bundle (unchanged since before
 * #806, still concatenated by `bundleEditorJs()`) must not run until
 * *after* `<EditorApp>` has actually finished its first hydration pass —
 * several of those modules mutate DOM inside {@link EDITOR_ROOT_ID}'s
 * boundary at plain module-top-level (`config-panel.ts`'s
 * `refreshAllColorUIs()`, `color-picker.ts`'s preset-swatch injection,
 * `init.ts`'s dark-mode/theme-button/line-number writes). Putting the
 * legacy bundle in a later `<script type="module">` tag looked sufficient
 * — document order among module scripts *is* execution order — but isn't:
 * `hydrateRoot()`'s initial hydration pass is scheduled at idle priority,
 * not run synchronously inside the `hydrateRoot()` call itself, so a later
 * script's synchronous top-level code can (and, confirmed empirically
 * while building this PR, did) still run to completion before React's own
 * hydration pass gets a chance to compare against pristine markup. See
 * `editor-app.tsx`'s {@link EDITOR_HYDRATED_EVENT} doc comment for the
 * full account and the fix: {@link EditorApp} dispatches that event from a
 * `useLayoutEffect`, which is only guaranteed to run after its commit
 * (including the hydration attach/compare, for the first commit) is done.
 *
 * {@link runLegacyEditorBundle} below `await`s that event, then loads the
 * bundle from an *inert* `<script>` element ({@link
 * EDITOR_LEGACY_APP_JS_ELEMENT_ID} — a `type` no browser recognizes as
 * executable, so it never auto-runs) via a `Blob` URL and a dynamic
 * `import()`, rather than a plain `<script type="module">` tag, which the
 * browser would execute immediately on parse with no way to delay it.
 *
 * `<NavIsland>` hydrates here too, via {@link hydrateNav}, in the *same*
 * bundle rather than a separate `nav-only-client.tsx` bundle — this page
 * already ships one react/react-dom copy for `EditorApp`'s own hydration,
 * so a second bundle just for Nav would pay for react/react-dom twice on
 * this page for no reason (mirrors `fork-fixes-client.tsx`'s identical
 * reasoning). Nav's own hydration has no known interaction with the legacy
 * bundle, so it isn't gated on {@link EDITOR_HYDRATED_EVENT}.
 */
import { createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import {
  EDITOR_HYDRATED_EVENT,
  EDITOR_LEGACY_APP_JS_ELEMENT_ID,
  EDITOR_PROPS_ELEMENT_ID,
  EDITOR_ROOT_ID,
  EditorApp,
  type EditorAppProps,
} from './components/editor-app.tsx'
import { hydrateNav } from './nav-client.tsx'

function readProps(): EditorAppProps {
  const propsEl = document.getElementById(EDITOR_PROPS_ELEMENT_ID)
  if (!propsEl?.textContent) {
    throw new Error(
      `editor-client: no #${EDITOR_PROPS_ELEMENT_ID} element with JSON content found`,
    )
  }
  return JSON.parse(propsEl.textContent) as EditorAppProps
}

/** Resolves the first time {@link EDITOR_HYDRATED_EVENT} fires. */
function waitForEditorHydration(): Promise<void> {
  return new Promise((resolve) => {
    window.addEventListener(EDITOR_HYDRATED_EVENT, () => resolve(), {
      once: true,
    })
  })
}

/**
 * Loads and runs the legacy `editor/js/*.ts` bundle from its inert
 * `<script>` element — see this file's header comment for why a plain
 * `<script type="module">` tag can't be used here. `/* @vite-ignore *\/`
 * tells Vite/Rollup not to try to statically analyze this import target —
 * it's a runtime-computed `blob:` URL, not a static module specifier, so
 * there is nothing for a bundler to resolve ahead of time.
 */
async function runLegacyEditorBundle(): Promise<void> {
  const scriptEl = document.getElementById(EDITOR_LEGACY_APP_JS_ELEMENT_ID)
  if (!scriptEl?.textContent) {
    throw new Error(
      `editor-client: no #${EDITOR_LEGACY_APP_JS_ELEMENT_ID} element with JS content found`,
    )
  }
  const blob = new Blob([scriptEl.textContent], { type: 'text/javascript' })
  const url = URL.createObjectURL(blob)
  try {
    await import(/* @vite-ignore */ url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function main(): Promise<void> {
  const container = document.getElementById(EDITOR_ROOT_ID)
  if (!container) {
    throw new Error(
      `editor-client: no #${EDITOR_ROOT_ID} element found to hydrate`,
    )
  }
  const props = readProps()
  const hydrated = waitForEditorHydration()
  hydrateRoot(container, createElement(EditorApp, props))
  // Nav is its own, separate hydration island — see this file's header
  // comment for why it's hydrated from this same bundle rather than a
  // dedicated one, and why it isn't gated on the legacy bundle's ordering
  // requirement.
  hydrateNav()
  await hydrated
  await runLegacyEditorBundle()
}

main()
