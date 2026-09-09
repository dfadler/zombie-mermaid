/**
 * Ambient globals the editor's client-side modules read off `window`.
 *
 * None of these three bridges is declared by the library types this
 * program pulls in: `window.__mermaid` is attached at runtime by
 * `src/browser.ts` (bundled separately and spliced into the same
 * `<script type="module">` — see `editor.ts`'s `generateEditorHtml()`),
 * `window.__themeState` by `demo/editor-theme-state-bridge.ts`, and
 * `window.__editorViewportState` (zombie-mermaid#807) directly by
 * `demo/components/editor-viewport.ts`'s `useEditorViewport` hook (part
 * of `<EditorApp>`'s own hydrated bundle, not a separate spliced-in
 * script) the same way.
 *
 * zombie-mermaid#809 added three more, two in the same "React registers,
 * legacy reads" direction as `__editorViewportState`
 * (`window.__editorTabsState`, by `demo/components/editor-tabs.ts`'s
 * `useEditorTabs`; `window.__editorDarkModeState`, by `demo/components/
 * editor-dark-mode.ts`'s `useEditorDarkMode` -- deliberately *not* a
 * separately-bundled bridge module the way `__themeState` is; see that
 * hook's header comment for the real cross-bundle duplicate-module-instance
 * bug that approach hit) and two in the *other* direction --
 * `window.__editorSharingState` and `window.__editorHelpersState`,
 * registered by this program's own `sharing.ts`/`editor-helpers.ts` for
 * `demo/components/editor-export.ts`'s `copyURL()`/`editor-buttons.ts`'s
 * Clear button to call, since those hooks need a still-legacy function
 * this time instead of the reverse.
 *
 * All of these already declare their own
 * `declare global { interface Window { ... } } }` augmentation for their
 * *own* tsconfig program (root tsconfig.json's `lib` has no DOM, so
 * `src/browser.ts` uses a narrower local `declare const window`; `demo/
 * tsconfig.json` includes DOM and covers the theme-state and
 * editor-viewport-state bridges). This editor/tsconfig.json program is a
 * separate `tsc` invocation from both, so it needs its own copy of the
 * shape actually used here rather than inheriting either.
 *
 * This is a plain ambient script file (no top-level import/export), so
 * these interface members merge directly into the global `Window` type for
 * every file `editor/tsconfig.json` includes — no import needed anywhere.
 */

interface EditorMermaidTheme {
  bg: string
  fg: string
  line?: string
  accent?: string
  muted?: string
  surface?: string
  border?: string
}

interface EditorMermaidBridge {
  THEMES: Record<string, EditorMermaidTheme>
  renderMermaidSVGAsync: (
    source: string,
    options: Record<string, unknown>,
  ) => Promise<string>
}

interface EditorThemeStateBridge {
  getTheme: () => string
  setTheme: (key: string) => void
  subscribe: (listener: (themeKey: string) => void) => () => void
}

interface EditorViewportStateBridge {
  getZoom: () => number
  applyZoom: () => void
}

/** zombie-mermaid#809 -- see `demo/components/editor-tabs.ts`'s `useEditorTabs`. */
interface EditorTabsStateBridge {
  getActiveTab: () => 'code' | 'config'
  subscribe: (listener: (tab: 'code' | 'config') => void) => () => void
}

/** zombie-mermaid#809 -- see `demo/components/editor-dark-mode.ts`'s `useEditorDarkMode`. */
interface EditorDarkModeStateBridge {
  getIsDark: () => boolean
  setIsDark: (dark: boolean) => void
  subscribe: (listener: (dark: boolean) => void) => () => void
}

/** zombie-mermaid#809 -- see `sharing.ts`'s own registration, bottom of that file. */
interface EditorSharingStateBridge {
  updateHash: () => void
}

/** zombie-mermaid#809 -- see `editor-helpers.ts`'s own registration, bottom of that file. */
interface EditorHelpersStateBridge {
  updateLineNumbers: () => void
}

interface Window {
  __mermaid: EditorMermaidBridge
  __themeState: EditorThemeStateBridge
  __editorViewportState: EditorViewportStateBridge
  __editorTabsState: EditorTabsStateBridge
  __editorDarkModeState: EditorDarkModeStateBridge
  __editorSharingState: EditorSharingStateBridge
  __editorHelpersState: EditorHelpersStateBridge
}
