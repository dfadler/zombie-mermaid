/**
 * The source toolbar's two generic buttons (Copy source, Clear) as a React
 * hook (zombie-mermaid#809). Replaces `editor/js/buttons.ts`'s top-level
 * `addEventListener` wiring with {@link useEditorButtons}, called directly
 * from `<EditorApp>`'s own body -- the same shape `editor-viewport.ts`'s
 * `useEditorViewport` established for #807.
 *
 * Both buttons are fully self-contained once dispatch can show a toast (no
 * bridge needed the way tabs/dark-mode need one for `config-panel.ts`/
 * `rendering.ts`), with one exception: Clear's old body called
 * `editor/js/editor-helpers.ts`'s `updateLineNumbers()` (not migrated by
 * this issue -- it's also called from the textarea's own `input`/`keydown`
 * listeners there, well outside this issue's five named files) to refresh
 * the gutter after programmatically emptying the textarea. Setting
 * `.value` in JS never fires a real `input` event, so this can't just
 * dispatch one and let that legacy listener pick it up. `editor-helpers.ts`
 * exposes `window.__editorHelpersState.updateLineNumbers` for exactly this
 * -- see that file's own comment and `editor/js/global.d.ts` for the
 * bridge's ambient declaration.
 */
import { useLayoutEffect, type Dispatch } from 'react'
import type { EditorAction, EditorRefs } from './editor-app.tsx'

declare global {
  interface Window {
    __editorHelpersState: {
      updateLineNumbers(): void
    }
  }
}

export interface UseEditorButtonsArgs {
  dispatch: Dispatch<EditorAction>
  refs: { current: EditorRefs | null }
}

/**
 * Wires the "Copy source" and "Clear" toolbar buttons -- replacing
 * `editor/js/buttons.ts`'s module-top-level equivalent. Call once,
 * unconditionally, from `<EditorApp>`'s own body.
 */
export function useEditorButtons({
  dispatch,
  refs,
}: UseEditorButtonsArgs): void {
  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return

    const onCopy = () => {
      navigator.clipboard.writeText(r.editor.value).then(() => {
        dispatch({ type: 'SHOW_TOAST', message: 'Source copied!' })
      })
    }

    const onClear = () => {
      r.editor.value = ''
      window.__editorHelpersState.updateLineNumbers()
      r.previewInner.innerHTML =
        '<div class="preview-placeholder">Start typing to render your diagram</div>'
      r.statusText.textContent = 'Ready'
      r.statusText.className = ''
      r.renderTime.textContent = ''
      window.history.replaceState(null, '', window.location.pathname)
    }

    r.copySourceBtn.addEventListener('click', onCopy)
    r.clearBtn.addEventListener('click', onClear)
    return () => {
      r.copySourceBtn.removeEventListener('click', onCopy)
      r.clearBtn.removeEventListener('click', onClear)
    }
  }, [refs, dispatch])
}
