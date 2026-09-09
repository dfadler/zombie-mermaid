// Test harness for the live editor's client-side modules (editor/js/*.ts).
//
// zombie-mermaid#766 converted editor/js/*.js from fixed-order concatenated
// plain scripts into real TS modules with explicit imports/exports, bundled
// via Vite the same way editor.ts's generated editor.html bundles them (see
// that file's bundleEditorJs()). This harness reuses the exact same
// bundleForBrowser() call on the exact same entry point (editor/js/index.ts)
// -- rather than re-implementing or duplicating the module list the way the
// old JS_FILES array here had to -- so there is no way for this harness's
// idea of "the app bundle" to drift from what editor.ts actually ships.
//
// The bundle itself is plain, import/export-free JS (a single Rollup chunk
// with no unresolved external imports and nothing the entry re-exports), so
// it evaluates as an ordinary *classic* script when handed to `window.eval`
// -- same as the old hand-concatenated js/*.js files did. Top-level
// `function`/`var`/`const` declarations in a classic script evaluated via
// *indirect* eval (`window.eval(...)`, as opposed to a bare `eval(...)`)
// land in the realm's global scope, which is why `env.window.eval('doRender()')`-
// style calls in the *.test.ts files alongside this harness still work
// unchanged after the conversion.
//
// The bundle only needs to be produced once per test run (the source is
// identical across every test), so it's cached in a module-level promise;
// each createEditorEnv() call still gets its own fresh jsdom window/document,
// preserving per-test isolation.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { vi } from 'vitest'
import { THEMES } from '@zombie-mermaid/core'
import { EditorApp } from '../../../demo/components/editor-app.tsx'
import { bundleForBrowser } from '../../../scripts/vite-bundle.ts'

let cachedAppJs: Promise<string> | undefined

function getAppJs(): Promise<string> {
  if (!cachedAppJs) {
    cachedAppJs = bundleForBrowser(
      new URL('../../js/index.ts', import.meta.url).pathname,
      { minify: false, treeshake: false },
    )
  }
  return cachedAppJs
}

/**
 * The editor's real `<body>` markup, minus the inlined scripts.
 *
 * Rendered from the same React component the generator ships
 * (demo/components/editor-app.tsx's `<EditorApp>`, zombie-mermaid#806 —
 * previously `editor-page.tsx`'s now-removed `<EditorChrome>`), so these
 * tests can't drift from what editor.html actually contains. `renderToStaticMarkup`,
 * not `renderToString`: this harness never runs a real `hydrateRoot()`
 * (see the module doc comment — `appJs` is evaluated with `window.eval`,
 * not React), so it has no use for `renderToString`'s hydration-boundary
 * comments. Theme entries use the raw THEMES key as their label — the
 * dropdown's human-friendly names live in editor.ts and are irrelevant to
 * what the js/*.js modules do with `data-theme`.
 */
function buildBodyHtml(): string {
  const themes = Object.keys(THEMES).map((key) => ({
    key,
    bg: THEMES[key]!.bg,
    label: key,
  }))
  return renderToStaticMarkup(createElement(EditorApp, { themes }))
}

export interface EditorEnv {
  window: InstanceType<typeof JSDOM>['window']
  document: Document
  renderMermaidSVGAsync: ReturnType<typeof vi.fn>
}

export interface CreateEditorEnvOptions {
  /** Override the mocked renderer. Defaults to resolving a canned SVG string. */
  renderImpl?: (
    source: string,
    options: Record<string, unknown>,
  ) => Promise<string>
  /**
   * Pre-seeds `localStorage` before `js/*.js` (init.js in particular) runs
   * -- e.g. `{ 'bm-editor-theme': 'nord' }` to exercise #688's one-time
   * migration off that retired key, which only has an effect if it's
   * present *before* init.js's module-top-level migration code runs.
   */
  localStorage?: Record<string, string>
}

/**
 * Builds a fresh jsdom environment with the real editor/js/*.ts bundle
 * loaded against the real page components' markup, and a mocked
 * window.__mermaid.renderMermaidSVGAsync (the one DOM-external dependency
 * the editor scripts pull in from the bundled renderer).
 */
export async function createEditorEnv(
  options: CreateEditorEnvOptions = {},
): Promise<EditorEnv> {
  const dom = new JSDOM(
    `<!doctype html><html><body>${buildBodyHtml()}</body></html>`,
    {
      url: 'https://editor.example/editor.html',
      runScripts: 'outside-only',
    },
  )
  const { window } = dom

  // jsdom doesn't implement the Blob object URL registry or the Clipboard API.
  window.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  window.URL.revokeObjectURL = vi.fn()
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: vi.fn(() => Promise.resolve()),
      write: vi.fn(() => Promise.resolve()),
    },
  })

  const renderMermaidSVGAsync = vi.fn(
    options.renderImpl ?? (async () => '<svg data-mock-render="1"></svg>'),
  )
  ;(window as unknown as { __mermaid: unknown }).__mermaid = {
    THEMES,
    renderMermaidSVGAsync,
  }

  // #688: init.js now calls window.__themeState.getTheme()/setTheme()/
  // subscribe() (demo/theme-state.ts, bridged for editor/js/*.js's plain
  // scripts via demo/editor-theme-state-bridge.ts in the real build) instead
  // of reading/writing localStorage directly. This harness evaluates the
  // real js/*.js files without that Vite-bundled bridge in the loop, so it
  // needs its own stand-in here -- a small, self-contained reimplementation
  // of theme-state.ts's actual get/set/subscribe/'' -default semantics
  // against this jsdom window's own localStorage, the same hand-built-stub
  // pattern __mermaid above already uses for renderMermaidSVGAsync.
  const THEME_STORAGE_KEY = 'mermaid-theme'
  const themeListeners = new Set<(themeKey: string) => void>()
  ;(
    window as unknown as {
      __themeState: {
        getTheme(): string
        setTheme(key: string): void
        subscribe(listener: (themeKey: string) => void): () => void
      }
    }
  ).__themeState = {
    getTheme() {
      return window.localStorage.getItem(THEME_STORAGE_KEY) ?? ''
    },
    setTheme(key: string) {
      if (key) window.localStorage.setItem(THEME_STORAGE_KEY, key)
      else window.localStorage.removeItem(THEME_STORAGE_KEY)
      for (const listener of themeListeners) listener(key)
    },
    subscribe(listener: (themeKey: string) => void) {
      themeListeners.add(listener)
      return () => {
        themeListeners.delete(listener)
      }
    },
  }

  // zombie-mermaid#807: editor/js/rendering.ts now reaches the current
  // zoom level via window.__editorViewportState (registered by
  // demo/components/editor-viewport.ts's useEditorViewport, which only
  // runs when <EditorApp> is actually mounted through React -- this
  // harness never does that, it only renders EditorApp's markup once via
  // renderToStaticMarkup for buildBodyHtml() above and then evals the raw
  // js/*.ts bundle directly). Stub it the same way __mermaid/__themeState
  // are stubbed above, so editor/js/rendering.ts's doRender() -- exercised
  // by rendering.test.ts -- has something to call.
  ;(
    window as unknown as {
      __editorViewportState: { getZoom(): number; applyZoom(): void }
    }
  ).__editorViewportState = {
    getZoom: () => 1,
    applyZoom: vi.fn(),
  }

  // zombie-mermaid#809: editor/js/tabs.ts and dark-mode.ts now subscribe to
  // window.__editorTabsState/window.__editorDarkModeState (registered by
  // demo/components/editor-tabs.ts's useEditorTabs and
  // demo/editor-dark-mode-state-bridge.ts respectively) at their own module
  // top level -- both unreachable from this harness for the same reason
  // __editorViewportState is, so both need a stand-in here too, or
  // evaluating the bundle throws immediately.
  ;(
    window as unknown as {
      __editorTabsState: {
        getActiveTab(): 'code' | 'config'
        subscribe(listener: (tab: 'code' | 'config') => void): () => void
      }
    }
  ).__editorTabsState = {
    getActiveTab: () => 'code',
    subscribe: () => () => {},
  }
  ;(
    window as unknown as {
      __editorDarkModeState: {
        getIsDark(): boolean
        setIsDark(dark: boolean): void
        subscribe(listener: (dark: boolean) => void): () => void
      }
    }
  ).__editorDarkModeState = {
    getIsDark: () => options.localStorage?.['bm-editor-dark'] === 'true',
    setIsDark: vi.fn(),
    subscribe: () => () => {},
  }

  for (const [key, value] of Object.entries(options.localStorage ?? {})) {
    window.localStorage.setItem(key, value)
  }

  const appJs = await getAppJs()
  window.eval(appJs)

  return { window, document: window.document, renderMermaidSVGAsync }
}

/** Waits for the debounced/scheduled render (setTimeout-based) to settle. */
export function flushRenderTimers(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20))
}
