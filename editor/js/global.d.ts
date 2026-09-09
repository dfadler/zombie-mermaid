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
 * script) the same way. All three already declare their own
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

/**
 * zombie-mermaid#808 -- registered by
 * demo/components/editor-config.tsx's `useEditorConfig`, read by
 * `rendering.ts`'s `buildOptions()`/`doRender()` in place of the deleted
 * `editor/js/config-panel.ts`'s `state.config`/`applyStrokeOverrides()`.
 * See that file's header comment for the full rationale.
 */
interface EditorConfigStateBridge {
  getConfig: () => Record<string, unknown>
  applyStrokeOverrides: (svgEl: SVGSVGElement | null) => void
}

/**
 * zombie-mermaid#808 -- the *reverse* direction from
 * `EditorConfigStateBridge`/`EditorViewportStateBridge` above: registered
 * by `rendering.ts` itself (the assigner, for once, rather than the
 * reader), called by `demo/components/editor-config.tsx`'s `ConfigPanel`
 * whenever a color/font/padding change needs to trigger a new render --
 * see that file's header comment for why this bridge exists (colors/font/
 * padding are React state now, with no access to this module's own
 * `scheduleRender` import).
 */
interface EditorRenderTriggerBridge {
  scheduleRender: (delay?: number) => void
}

interface Window {
  __mermaid: EditorMermaidBridge
  __themeState: EditorThemeStateBridge
  __editorViewportState: EditorViewportStateBridge
  __editorConfigState: EditorConfigStateBridge
  __editorRenderTrigger: EditorRenderTriggerBridge
}
