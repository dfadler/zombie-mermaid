/**
 * `window.__mermaid` is attached by src/browser.ts's bundle, spliced into
 * the page ahead of this module's own bundle -- see editor.ts's
 * generateEditorHtml(). Reading it here (rather than importing the
 * renderer directly) keeps the editor from bundling its own copy of the
 * renderer alongside the one already exposed on `window`.
 */
export const THEMES = window.__mermaid.THEMES
export const renderMermaid = window.__mermaid.renderMermaidSVGAsync

export interface EditorState {
  theme: string
}

// zombie-mermaid#807: `zoom` moved out of this module-level object and
// into <EditorApp>'s reducer (demo/components/editor-app.tsx) -- read it
// via window.__editorViewportState.getZoom() (the bridge
// demo/components/editor-viewport.ts's useEditorViewport registers), not
// from here.
//
// zombie-mermaid#808: `config` moved out the same way, into the same
// reducer (colors/font/padding fields) -- read it via
// window.__editorConfigState.getConfig() (registered by
// demo/components/editor-config.tsx's useEditorConfig). `theme` stays
// module-level for now; it migrates in its own later sub-issue (#809/#810).
export const state: EditorState = {
  theme: '',
}

/**
 * Duplicated verbatim (same literal string) in
 * demo/components/editor-config.tsx's `EDITOR_EFFECTIVE_THEME_EVENT` --
 * that file's header comment explains why this needs to be a plain
 * `window` event rather than a `window.__foo` bridge *object* like
 * `__editorViewportState`/`__editorConfigState` above: the object-bridge
 * direction there is React-writes/legacy-reads, safe because the legacy
 * bundle (the reader) only ever runs *after* React has already registered
 * it. This is the reverse direction (legacy writes `state.theme`, React
 * needs to read the *effective* current value -- see that file's header
 * comment for why that's not simply `window.__themeState.getTheme()`) --
 * an object registered here wouldn't exist yet by the time React's own
 * mount effect first runs, since this module only loads once the legacy
 * bundle does, which is gated behind `<EditorApp>` finishing its first
 * hydration pass. A raw event has no such ordering requirement.
 */
export const EDITOR_EFFECTIVE_THEME_EVENT = 'zm-editor-theme-changed'

/**
 * The only place `state.theme` should be assigned from now on
 * (zombie-mermaid#808) -- see `EDITOR_EFFECTIVE_THEME_EVENT`'s doc comment.
 * Three separate legacy call sites write `state.theme`
 * (`dark-mode.ts`'s auto-theme selection, `sharing.ts`'s URL-hash restore,
 * `init.ts`'s saved-theme restore/explicit picks), none of which previously
 * needed to notify anything outside this module's own scope; routing every
 * write through here means `demo/components/editor-config.tsx`'s
 * `ConfigPanel` (which needs the effective theme to show the right
 * "theme default" placeholder for an unset color) gets notified regardless
 * of which one changed it.
 */
export function setEditorTheme(themeKey: string): void {
  state.theme = themeKey
  window.dispatchEvent(
    new CustomEvent<string>(EDITOR_EFFECTIVE_THEME_EVENT, {
      detail: themeKey,
    }),
  )
}
