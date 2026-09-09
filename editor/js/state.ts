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
  config: Record<string, unknown>
}

// zombie-mermaid#807: `zoom` moved out of this module-level object and
// into <EditorApp>'s reducer (demo/components/editor-app.tsx) -- read it
// via window.__editorViewportState.getZoom() (the bridge
// demo/components/editor-viewport.ts's useEditorViewport registers), not
// from here. `theme`/`config` stay module-level for now; they migrate in
// their own later sub-issues (#808-#810).
export const state: EditorState = {
  theme: '',
  config: {},
}
