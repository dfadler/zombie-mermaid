/**
 * The editor's dark/light chrome toggle button as React state
 * (zombie-mermaid#809). Replaces `editor/js/dark-mode.ts`'s module-level
 * `isDark` variable and its click listener with `editor-app.tsx`'s reducer
 * (`state.darkMode`) and {@link useEditorDarkMode}, called directly from
 * `<EditorApp>`'s own body -- the same shape `editor-viewport.ts`'s
 * `useEditorViewport` established for #807.
 *
 * Persistence goes through `demo/editor-dark-mode-state.ts` (`getIsDark`/
 * `setIsDark`/`subscribe`), not a `localStorage` call inlined here -- see
 * that module's header comment for why it's a *separate* module from
 * `demo/theme-state.ts` rather than a reuse of it (they're different
 * concepts, despite both being "a persisted appearance preference").
 *
 * ## The `window.__editorDarkModeState` bridge
 *
 * `editor/js/dark-mode.ts` (still legacy -- see below) needs to read/
 * subscribe to the same dark-mode state this hook owns, but can't `import`
 * `demo/editor-dark-mode-state.ts` directly the way this hook does: that
 * module graph is bundled *separately* (`editor.ts`'s `bundleEditorJs()`),
 * so importing the same source file from both bundles would produce two
 * independent module instances with their own, unsynchronized `listeners`
 * `Set` -- confirmed as a real bug via live-browser verification while
 * building this PR (an earlier version used a separately-bundled bridge
 * module for this instead, which hit exactly that problem: `setIsDark()`
 * called through one bundle's copy never reached `subscribe()` calls
 * registered through the other's). Registering the bridge here instead --
 * from the same hook, in the same bundle as the `getIsDark`/`setIsDark`
 * calls below -- guarantees both sides talk to the *same* module instance,
 * the same pattern `editor-viewport.ts`'s `window.__editorViewportState`
 * and `editor-tabs.ts`'s `window.__editorTabsState` already use. See
 * `editor/js/global.d.ts` for the ambient declaration.
 *
 * ## What stays legacy, and why
 *
 * `editor/js/dark-mode.ts`'s old `applyColorMode()` did five things: (1)
 * toggle the moon/sun icons, (2) persist to `localStorage`, (3) derive an
 * "auto" diagram theme from dark/light and write `state.theme`, (4) call
 * `applyThemeToPage()`/`updateThemeButton()`/`refreshAllColorUIs()`/
 * `scheduleRender()`. This hook owns (1) directly (icon refs) and (2)
 * through the state module above; (3) and (4) all reach into `state.theme`
 * (`editor/js/state.ts`, migrating in #808-#810) and three still-legacy
 * modules' functions (`config-panel.ts`, `rendering.ts`, `theme-button.ts`)
 * -- none of which this issue owns, and `demo/components/*.tsx` doesn't
 * import from `editor/js/*.ts` regardless (see `editor-app.tsx`'s
 * `requireEditorElement` doc comment). So (3)/(4) stay in a *shrunk*
 * `editor/js/dark-mode.ts`, which now does nothing but subscribe to the
 * bridge below and re-run that old orchestration whenever this hook calls
 * `setIsDark()` -- see that legacy file's own header comment.
 */
import { useLayoutEffect, useRef, type Dispatch } from 'react'
import { getIsDark, setIsDark, subscribe } from '../editor-dark-mode-state.ts'
import type { EditorAction, EditorRefs, EditorState } from './editor-app.tsx'

declare global {
  interface Window {
    __editorDarkModeState: {
      getIsDark: typeof getIsDark
      setIsDark: typeof setIsDark
      subscribe: typeof subscribe
    }
  }
}

export interface UseEditorDarkModeArgs {
  state: EditorState
  dispatch: Dispatch<EditorAction>
  refs: { current: EditorRefs | null }
}

/**
 * Wires the dark/light toggle button and syncs the moon/sun icons with
 * `state.darkMode` -- replacing `editor/js/dark-mode.ts`'s module-top-level
 * equivalent. Call once, unconditionally, from `<EditorApp>`'s own body.
 */
export function useEditorDarkMode({
  state,
  dispatch,
  refs,
}: UseEditorDarkModeArgs): void {
  const stateRef = useRef(state)
  stateRef.current = state

  // The window.__editorDarkModeState bridge for editor/js/dark-mode.ts --
  // see this file's header comment for why it's registered here rather
  // than from a separately-bundled module.
  useLayoutEffect(() => {
    window.__editorDarkModeState = { getIsDark, setIsDark, subscribe }
  }, [])

  // Restore the persisted preference once, after mount -- same timing as
  // editor/js/init.ts's old `applyColorMode(isDark)` bootstrap call (both
  // only ever ran after EditorApp had already hydrated). Doesn't call
  // setIsDark()/notify subscribers -- the (still legacy) dark-mode.ts
  // applies the *initial* value itself, directly through
  // window.__editorDarkModeState.getIsDark(), at its own module top level
  // (unchanged timing from before this issue). This effect only needs to
  // seed *this* component's own state so the icons it owns render
  // correctly.
  const didInit = useRef(false)
  useLayoutEffect(() => {
    if (didInit.current) return
    didInit.current = true
    if (getIsDark()) {
      dispatch({ type: 'SET_DARK_MODE', dark: true })
    }
  }, [dispatch])

  // Icon visibility -- editor/js/dark-mode.ts's old applyColorMode() icon
  // half.
  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return
    r.iconMoon.style.display = state.darkMode ? 'none' : ''
    r.iconSun.style.display = state.darkMode ? '' : 'none'
  }, [state.darkMode, refs])

  // Click handler: persist + notify (the legacy dark-mode.ts subscriber
  // re-runs its own theme/render orchestration off this), then update this
  // component's own state.
  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return
    const onClick = () => {
      const next = !stateRef.current.darkMode
      setIsDark(next)
      dispatch({ type: 'SET_DARK_MODE', dark: next })
    }
    r.darkLightBtn.addEventListener('click', onClick)
    return () => r.darkLightBtn.removeEventListener('click', onClick)
  }, [refs, dispatch])
}
