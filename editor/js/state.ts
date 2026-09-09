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
  zoom: number
  config: Record<string, unknown>
}

export const state: EditorState = {
  theme: '',
  zoom: 1,
  config: {},
}
