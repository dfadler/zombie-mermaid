/**
 * The editor's toast notification as React state (zombie-mermaid#809).
 * Replaces `editor/js/toast.ts`'s module-level `toastTimer` and its
 * imperative `toast.textContent`/`classList.add('show')`/`setTimeout`
 * dance with `editor-app.tsx`'s reducer (`toastMessage`/`toastVisible`/
 * `toastNonce`) and {@link useEditorToast}, called directly from
 * `<EditorApp>`'s own body.
 *
 * Unlike tabs/dark-mode, this hook needs no `window.__editor*State` bridge:
 * `showToast()`'s only two callers (`editor/js/buttons.ts`, `editor/js/
 * export.ts`) are both converted by this same issue, and now show a toast
 * by dispatching `SHOW_TOAST` directly (they already hold `dispatch` --
 * see `editor-buttons.ts`/`editor-export.ts`) instead of calling an
 * imported function. Rendering the message/`.show` class is
 * `editor-app.tsx`'s `EditorChromeMarkup`'s job (plain JSX driven by
 * `state.toastMessage`/`toastVisible`); this hook only owns the
 * auto-dismiss timer.
 */
import { useLayoutEffect, type Dispatch } from 'react'
import type { EditorAction, EditorState } from './editor-app.tsx'

/** Matches `editor/js/toast.ts`'s original auto-dismiss delay exactly. */
export const TOAST_DISMISS_MS = 2500

export interface UseEditorToastArgs {
  state: EditorState
  dispatch: Dispatch<EditorAction>
}

/**
 * Auto-dismisses the toast `TOAST_DISMISS_MS` after it was last shown --
 * replacing `editor/js/toast.ts`'s `clearTimeout`/`setTimeout` pair. Keyed
 * on `state.toastNonce` (not `toastMessage`) so a repeat of the *same*
 * message still restarts the full window -- see `EditorState.toastNonce`'s
 * doc comment in `editor-app.tsx`. React's guaranteed cleanup-before-next-
 * effect ordering across renders is what replaces the old `clearTimeout`
 * call: a new nonce runs this effect's cleanup (clearing the previous
 * timer) before scheduling a fresh one.
 */
export function useEditorToast({ state, dispatch }: UseEditorToastArgs): void {
  useLayoutEffect(() => {
    if (state.toastNonce === 0) return
    const timer = setTimeout(() => {
      dispatch({ type: 'HIDE_TOAST' })
    }, TOAST_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [state.toastNonce, dispatch])
}
