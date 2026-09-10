/**
 * Ambient globals the editor's client-side modules read off `window`.
 *
 * Trimmed by zombie-mermaid#810 (the last editor sub-issue) down to the two
 * bridges `editor/js/editor-helpers.ts` -- the only module left in this
 * program's own bundle -- still actually uses:
 *
 * - `window.__editorRenderTrigger` (React registers, this program reads):
 *   registered by `demo/components/editor-rendering.ts`'s
 *   `useEditorRendering`, called by `editor-helpers.ts`'s `input`/`keydown`
 *   listeners to trigger a debounced render -- the same bridge
 *   `demo/components/editor-config.tsx`'s `ConfigPanel` already called
 *   through before #810 (`rendering.ts` registered it back then; the
 *   *shape* hasn't changed, only which program owns the registration).
 * - `window.__editorHelpersState` (this program registers, React reads):
 *   registered by `editor-helpers.ts` itself, called by
 *   `demo/components/editor-buttons.ts`'s Clear button (zombie-mermaid#809).
 *
 * Every other bridge that used to live here (`__mermaid`, `__themeState`,
 * `__editorViewportState`, `__editorConfigState`, `__editorTabsState`,
 * `__editorDarkModeState`, `__editorSharingState`) was only ever read by
 * `editor/js/state.ts`/`rendering.ts`/`dark-mode.ts`/`theme-button.ts`/
 * `init.ts` -- all deleted by #810 and moved to React, which reaches
 * `window.__mermaid`/`window.__themeState`/etc. through `demo/`'s own
 * `tsconfig.json` (DOM-aware) ambient types instead of this program's.
 *
 * This is a plain ambient script file (no top-level import/export), so
 * these interface members merge directly into the global `Window` type for
 * every file `editor/tsconfig.json` includes -- no import needed anywhere.
 */

interface EditorRenderTriggerBridge {
  scheduleRender: (delay?: number) => void
}

interface EditorHelpersStateBridge {
  updateLineNumbers: () => void
}

interface Window {
  __editorRenderTrigger: EditorRenderTriggerBridge
  __editorHelpersState: EditorHelpersStateBridge
}
