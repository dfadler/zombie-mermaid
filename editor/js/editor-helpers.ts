/**
 * `updateLineNumbers()` is also exposed on `window.__editorHelpersState`
 * (bottom of this file) for `demo/components/editor-buttons.ts`'s Clear
 * button (zombie-mermaid#809) to call: setting `editor.value = ''`
 * programmatically never fires a real `input` event, so the `input`
 * listener below (which would otherwise call this) never runs, and
 * `demo/components/*.tsx` doesn't import from `editor/js/*.ts` directly
 * (see `demo/components/editor-app.tsx`'s `requireEditorElement` doc
 * comment) -- this module isn't migrated by #809 itself (it's also used by
 * the plain `input`/`keydown` listeners below, well outside that issue's
 * five named files), so it stays legacy and exposes this one function the
 * same way `editor/js/sharing.ts` used to expose `updateHash` for the same
 * reason (that module is gone as of #810 -- see below).
 *
 * zombie-mermaid#810 deleted `editor/js/rendering.ts` (moved to React,
 * `demo/components/editor-rendering.ts`), so the `scheduleRender` this
 * module's `input`/`keydown` listeners call is no longer a same-program
 * import -- it's reached through `window.__editorRenderTrigger` instead,
 * the same bridge `demo/components/editor-config.tsx`'s `ConfigPanel`
 * already called `rendering.ts` through before this issue (see that
 * hook's own header comment). Unlike that call site, this one isn't
 * optional (`?.`): this legacy bundle only ever loads *after*
 * `<EditorApp>` has finished hydrating -- see `editor-app.tsx`'s
 * `EDITOR_HYDRATED_EVENT` doc comment -- so `useEditorRendering`'s
 * bridge-registering effect has always already run by the time this
 * module's own top-level code (or either listener below) executes.
 *
 * This module also now calls `updateLineNumbers()` once at its own
 * top level (bottom of this file) -- `editor/js/init.ts`'s old final
 * `updateLineNumbers()` bootstrap call, moved here since that file is
 * gone too (folded into `editor-theme.ts`'s `useEditorTheme` bootstrap
 * effect, which has already set `editor.value` to its real initial
 * source text by the time this module loads).
 */
import { cursorPos, editor, lineNumbers } from './elements.ts'

export function updateLineNumbers(): void {
  const lines = editor.value.split('\n').length
  let html = ''
  for (let i = 1; i <= lines; i++) html += i + '\n'
  lineNumbers.textContent = html
}

export function updateCursorPos(): void {
  const val = editor.value
  const pos = editor.selectionStart ?? 0
  const lines = val.substring(0, pos).split('\n')
  const line = lines.length
  const col = (lines[lines.length - 1]?.length ?? 0) + 1
  cursorPos.textContent = 'Ln ' + line + ', Col ' + col
}

editor.addEventListener('scroll', function () {
  lineNumbers.scrollTop = editor.scrollTop
})

editor.addEventListener('input', function () {
  updateLineNumbers()
  window.__editorRenderTrigger.scheduleRender()
})

editor.addEventListener('keydown', function (e) {
  if (e.key === 'Tab') {
    e.preventDefault()
    const start = editor.selectionStart ?? 0
    const end = editor.selectionEnd ?? 0
    editor.value =
      editor.value.substring(0, start) + '  ' + editor.value.substring(end)
    editor.selectionStart = editor.selectionEnd = start + 2
    updateLineNumbers()
    window.__editorRenderTrigger.scheduleRender()
    return
  }
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    window.__editorRenderTrigger.scheduleRender(0)
    return
  }
})

editor.addEventListener('keyup', updateCursorPos)
editor.addEventListener('click', updateCursorPos)

// The window.__editorHelpersState bridge for editor-buttons.ts's Clear
// button -- see this file's header comment.
window.__editorHelpersState = { updateLineNumbers }

// editor/js/init.ts's old final bootstrap call (gone as of #810) -- see
// this file's header comment for why it moved here.
updateLineNumbers()
