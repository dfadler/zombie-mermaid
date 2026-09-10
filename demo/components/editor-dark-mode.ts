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
 * ## Chrome color mode, owned entirely by this hook
 *
 * The original `editor/js/dark-mode.ts`'s `applyColorMode()` did five
 * things: (1) toggle the moon/sun icons, (2) persist to `localStorage`, (3)
 * derive an "auto" diagram theme from dark/light and write `state.theme`,
 * (4) write the tool chrome's `--t-bg`/`--t-fg`/`--t-accent`/etc `:root`
 * vars. #810 moved (3) to `editor-theme.ts` (it derives the diagram theme
 * from `getIsDark()`/a dark-mode subscription there instead). (4) used to
 * live in `editor-rendering.ts`'s `applyThemeToPage()`, run from a
 * `state.theme`-keyed effect -- which meant picking any of the 15 diagram
 * themes also reskinned the topbar/panels/pickers to match, not just the
 * rendered diagram. {@link applyChromeColorMode} below moves (4) here and
 * keys it on `state.darkMode` alone, so the tool's own chrome now only ever
 * follows this light/dark toggle -- never the diagram theme dropdown. See
 * `docs/decisions/theme-selector-shared-state.md`'s amendment for the full
 * rationale.
 */
import { useLayoutEffect, useRef, type Dispatch } from 'react'
import { getIsDark, setIsDark, subscribe } from '../editor-dark-mode-state.ts'
import type { EditorAction, EditorRefs, EditorState } from './editor-app.tsx'
import { hexToRgb } from './editor-rendering.ts'

declare global {
  interface Window {
    __editorDarkModeState: {
      getIsDark: typeof getIsDark
      setIsDark: typeof setIsDark
      subscribe: typeof subscribe
    }
  }
}

/**
 * Sets the editor chrome's `--t-bg`/`--t-fg`/`--t-accent`/`--foreground-rgb`/
 * `--shadow-*` custom properties on `:root` from light/dark mode alone --
 * moved here (and no longer theme-keyed) from `editor-rendering.ts`'s old
 * `applyThemeToPage()`, which used to also override these from whichever
 * diagram theme was selected, reskinning the topbar/panels/pickers
 * (`editor/css/variables.css` derives its whole palette from these three) to
 * match. That coupling is gone: the diagram's own colors now only ever
 * reach `buildOptions()`/the rendered `<svg>` (`editor-rendering.ts`), and
 * this function is the tool chrome's only remaining source of truth for
 * `--t-*`, driven solely by `state.darkMode` below.
 */
function applyChromeColorMode(dark: boolean): void {
  const root = document.documentElement
  root.style.setProperty('--t-bg', dark ? '#18181B' : '#FFFFFF')
  root.style.setProperty('--t-fg', dark ? '#FAFAFA' : '#27272A')
  root.style.setProperty('--t-accent', dark ? '#60a5fa' : '#3b82f6')
  const fg = root.style.getPropertyValue('--t-fg').trim() || '#27272A'
  const rgb = hexToRgb(fg)
  if (rgb) {
    root.style.setProperty(
      '--foreground-rgb',
      rgb.r + ', ' + rgb.g + ', ' + rgb.b,
    )
    const bgRgb = hexToRgb(root.style.getPropertyValue('--t-bg').trim())
    const brightness = bgRgb
      ? (bgRgb.r * 299 + bgRgb.g * 587 + bgRgb.b * 114) / 1000
      : 255
    const shadowDark = brightness < 140
    root.style.setProperty(
      '--shadow-border-opacity',
      shadowDark ? '0.15' : '0.08',
    )
    root.style.setProperty(
      '--shadow-blur-opacity',
      shadowDark ? '0.12' : '0.06',
    )
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

  // Chrome color mode -- editor/js/dark-mode.ts's old applyColorMode()
  // :root-var half, now keyed purely on state.darkMode instead of also
  // running from editor-rendering.ts's theme-change effect. Runs on mount
  // too (an effect with a dependency array always runs once regardless of
  // the dependency's initial value), so this is also this tool's only
  // source for the chrome's starting --t-bg/--t-fg/--t-accent/etc, matching
  // the old code's unconditional call from every re-theme path.
  useLayoutEffect(() => {
    applyChromeColorMode(state.darkMode)
  }, [state.darkMode])

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
