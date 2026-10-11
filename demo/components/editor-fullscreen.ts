/**
 * The editor's fullscreen toggle: makes `.editor-tool-shell` (the tool's own
 * card -- see `editor-page.tsx`'s module doc comment, "The tool now lives in
 * a fixed-height card") take over the whole viewport via the browser's real
 * Fullscreen API (`Element.requestFullscreen()`/`document.exitFullscreen()`),
 * not a CSS-only overlay. That native call is what actually hides the
 * marketing nav/hero/footer around the card and, in most browsers, the
 * browser chrome itself -- a CSS `position: fixed` box could only ever cover
 * the page, not the browser UI, and would still need its own scroll-lock and
 * Esc handling that the platform already gives Fullscreen API callers for
 * free. `editor-page.tsx`'s `editorPageCss()` supplies the matching
 * `.editor-tool-shell:fullscreen` rule that resets the card's normal
 * bordered/max-width/centered layout to fill the fullscreen element.
 *
 * A click handler wires a DOM/browser effect, and a pair of icons
 * (`icon-fullscreen-enter`/`icon-fullscreen-exit`) swaps visibility off
 * `state.fullscreen`.
 *
 * `state.fullscreen` is never set optimistically from the click handler --
 * only from a `fullscreenchange` listener reading `document.fullscreenElement`
 * -- so it always reflects what the browser actually did, including the
 * cases the click handler doesn't control at all: the user pressing Esc, the
 * browser exiting fullscreen on its own (e.g. losing focus in some browsers),
 * or `requestFullscreen()` rejecting (blocked by a permissions policy, no
 * user-activation, etc. -- MDN's `requestFullscreen()` reference documents
 * these as real, non-exceptional rejection cases, not bugs to route around).
 */
import { useLayoutEffect, type Dispatch } from 'react'
import type { EditorAction, EditorRefs, EditorState } from './editor-app.tsx'

/**
 * The element `requestFullscreen()`/`document.fullscreenElement` target --
 * `.editor-tool-shell` in production, falling back to
 * `document.documentElement` when the page wrapper isn't mounted (e.g. a
 * test harness that mounts `<EditorApp>` directly). Exported for direct
 * testing, mirroring `collectEditorRefs`'s "small pure/DOM-query function,
 * exported for direct testing" precedent.
 */
export function getFullscreenTarget(): HTMLElement {
  return (
    document.querySelector<HTMLElement>('.editor-tool-shell') ??
    document.documentElement
  )
}

export interface UseEditorFullscreenArgs {
  state: EditorState
  dispatch: Dispatch<EditorAction>
  refs: { current: EditorRefs | null }
}

/**
 * Wires the fullscreen toggle button and syncs the enter/exit icons and the
 * button's title/`aria-pressed` with `state.fullscreen`. Call once,
 * unconditionally, from `<EditorApp>`'s own body.
 */
export function useEditorFullscreen({
  state,
  dispatch,
  refs,
}: UseEditorFullscreenArgs): void {
  // Keeps state.fullscreen in sync with reality -- see this file's header
  // comment for why this (not the click handler) is the sole writer.
  useLayoutEffect(() => {
    const onFullscreenChange = () => {
      dispatch({
        type: 'SET_FULLSCREEN',
        fullscreen: document.fullscreenElement != null,
      })
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () =>
      document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [dispatch])

  // Click handler: ask the browser to enter/exit, based on what it reports
  // right now -- editor/js/dark-mode.ts's click-handler shape (read the DOM
  // truth, not a possibly-stale stateRef), except there's no stateRef to
  // read here at all: document.fullscreenElement already is that truth.
  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return
    const onClick = () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {
          // Rejected exit (e.g. already left some other way) -- the next
          // fullscreenchange, if any, is still what state.fullscreen syncs
          // from; nothing to recover here.
        })
      } else {
        getFullscreenTarget()
          .requestFullscreen()
          .catch(() => {
            // Rejected entry (no user-activation, a permissions-policy
            // block, ...) -- state.fullscreen simply never flips, since no
            // fullscreenchange fires for a request that never took effect.
          })
      }
    }
    r.fullscreenBtn.addEventListener('click', onClick)
    return () => r.fullscreenBtn.removeEventListener('click', onClick)
  }, [refs])

  // Icon visibility + title/aria-pressed, kept in sync with state.fullscreen.
  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return
    r.iconFullscreenEnter.style.display = state.fullscreen ? 'none' : ''
    r.iconFullscreenExit.style.display = state.fullscreen ? '' : 'none'
    r.fullscreenBtn.title = state.fullscreen
      ? 'Exit fullscreen'
      : 'Enter fullscreen'
    r.fullscreenBtn.setAttribute('aria-pressed', String(state.fullscreen))
  }, [state.fullscreen, refs])
}
