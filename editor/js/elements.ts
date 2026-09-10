/**
 * The DOM elements still-legacy `editor/js/*.ts` modules cache at
 * module-eval time. Trimmed by zombie-mermaid#810 to the three ids
 * `editor/js/editor-helpers.ts` (the only remaining module that needs
 * them) actually uses -- every other element this file used to export
 * (`previewInner`, `statusText`, `themeMenu`, ...) was only ever read by
 * `rendering.ts`/`dark-mode.ts`/`theme-button.ts`/`init.ts`, all deleted by
 * that issue and moved to React (`demo/components/editor-app.tsx`'s own
 * `collectEditorRefs()` now caches the full set for React's side instead).
 */
import { requireElement } from './dom.ts'

export const editor = requireElement('code-editor', HTMLTextAreaElement)
export const lineNumbers = requireElement('line-numbers', HTMLElement)
export const cursorPos = requireElement('cursor-pos', HTMLElement)
