/**
 * zombie-mermaid#809: the dark/light toggle button itself, the moon/sun
 * icons, and the `bm-editor-dark` `localStorage` key all moved to React --
 * see `demo/components/editor-dark-mode.ts`'s `useEditorDarkMode` and
 * `demo/editor-dark-mode-state.ts`. What's left here is the orchestration
 * that toggle used to trigger and that nothing else in this issue owns:
 * deriving an "auto" diagram theme from dark/light and reapplying
 * `state.theme`/the theme button/a fresh render -- `state.theme`
 * (`editor/js/state.ts`) and `rendering.ts`/`theme-button.ts` migrate to
 * React in #810, not this issue, and `demo/components/*.tsx` doesn't import
 * from `editor/js/*.ts` regardless (see `demo/components/editor-app.tsx`'s
 * `requireEditorElement` doc comment) -- so this module now subscribes to
 * `window.__editorDarkModeState` (registered directly by
 * `demo/components/editor-dark-mode.ts`'s `useEditorDarkMode`) instead of
 * owning the button itself.
 *
 * zombie-mermaid#808: `config-panel.ts` (mentioned above as a #808-#810
 * migration target when this file was first written) is gone now -- the
 * config view's color fields are a live React component
 * (`demo/components/editor-config.tsx`'s `ConfigPanel`) that reacts to
 * `setEditorTheme()`'s `zm-editor-theme-changed` event itself, so this
 * module no longer calls `refreshAllColorUIs()` and writes through
 * `setEditorTheme()` (the only place `state.theme` is written now) instead
 * of assigning `state.theme` directly.
 */
import { applyThemeToPage, scheduleRender } from './rendering.ts'
import { setEditorTheme, state } from './state.ts'
import { updateThemeButton } from './theme-button.ts'

const AUTO_DARK_DIAGRAM_THEME = 'zinc-dark'
const AUTO_LIGHT_DIAGRAM_THEME = ''

let diagramThemeIsAuto = true

/** The only cross-file writer of `diagramThemeIsAuto` -- see init.ts. */
export function setDiagramThemeIsAuto(value: boolean): void {
  diagramThemeIsAuto = value
}

/**
 * Verbatim body of the old `applyColorMode`, minus the `isDark`
 * module-level assignment and the icon/`localStorage` writes -- both now
 * owned by `useEditorDarkMode` (see this file's header comment).
 */
function applyColorMode(dark: boolean, force?: boolean): void {
  if (diagramThemeIsAuto || force) {
    const autoTheme = dark ? AUTO_DARK_DIAGRAM_THEME : AUTO_LIGHT_DIAGRAM_THEME
    setEditorTheme(autoTheme)
    diagramThemeIsAuto = true
  }
  applyThemeToPage(state.theme)
  updateThemeButton()
  scheduleRender(0)
}

// Apply the persisted preference once at startup -- editor/js/init.ts's old
// `applyColorMode(isDark)` bootstrap call, moved here since this module
// (not init.ts) owns `applyColorMode`. Safe at this module's own top level:
// by the time it runs, `rendering.ts` and `theme-button.ts` (imported
// above) have already finished their own top-level DOM-ref setup, exactly
// as when this call lived further down in init.ts (see that file's own
// former comment: "must happen after all DOM refs + functions are ready").
applyColorMode(window.__editorDarkModeState.getIsDark())

// Re-run on every toggle -- always `force: true`, matching the old click
// handler's `applyColorMode(!isDark, true)` (a manual toggle always wins
// over a previously-picked explicit theme).
window.__editorDarkModeState.subscribe((dark) => applyColorMode(dark, true))
