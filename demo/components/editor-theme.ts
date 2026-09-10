/**
 * The diagram-color-theme dropdown, and the editor's client-side bootstrap,
 * as React state (zombie-mermaid#810) -- the last slice of the #797 editor
 * rewrite. Replaces `editor/js/theme-button.ts` and the theme/bootstrap
 * portions of `editor/js/dark-mode.ts` and `editor/js/init.ts` (all deleted
 * by this issue) with {@link useEditorTheme}, called directly from
 * `<EditorApp>`'s own body -- the same shape `editor-viewport.ts`'s
 * `useEditorViewport` established for #807.
 *
 * `state.theme`/`SET_THEME` already existed in `editor-app.tsx`'s reducer
 * (added by #806 as a minimal placeholder, unused until now -- see that
 * file's `EditorState` doc comment): this issue is what actually starts
 * dispatching it.
 *
 * ## Why theme selection landed in #810, not #808/#809
 *
 * `editor-config.tsx`'s header comment (#808) and `editor/js/dark-mode.ts`'s
 * header comment (#809) both explicitly deferred `state.theme`/
 * `editor/js/rendering.ts`/`editor/js/theme-button.ts` to "#809/#810" and
 * "#810" respectively -- `editor/js/state.ts`'s own comment says the same
 * ("`theme` stays module-level for now; it migrates in its own later
 * sub-issue (#809/#810)"). #809 shipped without touching it, so it's this
 * issue's job.
 *
 * ## The `zm-editor-theme-changed` event -- preserved, unchanged
 *
 * `editor-config.tsx`'s `ConfigPanel` (#808) already listens for
 * `EDITOR_EFFECTIVE_THEME_EVENT` (`zm-editor-theme-changed`) to show the
 * right "theme default" placeholder for an unset color -- see that file's
 * header comment for why it's a raw `window` event rather than a bridge
 * object. Now that `state.theme` is real reducer state instead of
 * `editor/js/state.ts`'s module-level `state.theme`, the *source* of the
 * event changes (this hook dispatches it from a `state.theme`-keyed effect
 * instead of `editor/js/state.ts`'s `setEditorTheme()` calling it directly),
 * but the event name and payload shape are identical, so `editor-config.tsx`
 * itself needs no changes.
 *
 * ## Bootstrap: folding `editor/js/init.ts` in
 *
 * `editor/js/init.ts`'s job was "run once, after everything else is ready,
 * to establish the editor's starting state" -- exactly what a hydration
 * entry point's initial-mount logic is for (see this issue's own text). The
 * bootstrap effect below reproduces its *exact* sequence, since later steps
 * depend on earlier ones (a URL-hash theme overrides a saved theme, which
 * overrides the dark-mode-derived default):
 *
 * 1. Derive an initial diagram theme from dark/light mode (old
 *    `dark-mode.ts` module-top-level `applyColorMode(getIsDark())`).
 * 2. One-time `bm-editor-theme` → shared `mermaid-theme` key migration
 *    (#688).
 * 3. Restore the shared saved theme preference, if any (overrides step 1).
 * 4. Parse the URL hash, if any -- its source text wins over the default
 *    diagram, and its theme (if present) wins over step 3. *Any* hash
 *    source at all -- even one with no theme in it -- permanently disables
 *    the dark-mode-driven auto-theme for the rest of the session, matching
 *    `editor/js/init.ts`'s old unconditional `setDiagramThemeIsAuto(false)`
 *    inside its `if (hashSource)` branch.
 * 5. Dispatch the final theme once and set the textarea's initial value,
 *    then trigger the first render.
 *
 * This effect is declared *before* the cross-tab `subscribe()` effect below
 * in this function's body on purpose: step 2's migration can itself call
 * `setTheme()` (which notifies synchronously), and React runs a single
 * component's layout effects in declaration order within one commit -- so
 * the subscription isn't listening yet when that happens, mirroring
 * `editor/js/init.ts`'s own ordering (the migration ran before
 * `window.__themeState.subscribe(applyTheme)` was registered there too).
 *
 * `editor/js/editor-helpers.ts` (still legacy, not migrated by this issue)
 * calls `updateLineNumbers()` once at its own module top level now, reading
 * the `refs.editor.value` this bootstrap effect already set -- see that
 * file's header comment. It couldn't be done here: that function doesn't
 * exist yet when this effect runs (the legacy bundle only loads *after*
 * `<EditorApp>` finishes hydrating -- see `editor-app.tsx`'s
 * `EDITOR_HYDRATED_EVENT` doc comment).
 */
import { useLayoutEffect, useRef, type Dispatch } from 'react'
import {
  getIsDark,
  subscribe as subscribeDarkMode,
} from '../editor-dark-mode-state.ts'
import {
  getTheme,
  setTheme as persistTheme,
  subscribe as subscribeThemeState,
} from '../theme-state.ts'
import type { EditorAction, EditorRefs, EditorState } from './editor-app.tsx'
import { parseHash } from './editor-sharing.ts'
import type { EditorThemeItem } from './editor-topbar.tsx'
import { readMermaidThemes } from './editor-rendering.ts'

/** Duplicated verbatim in `editor-config.tsx` -- see that file's header comment for why the string can't just be imported from there (separate concern, no runtime coupling intended). */
export const EDITOR_EFFECTIVE_THEME_EVENT = 'zm-editor-theme-changed'

/** Mirrors `editor/js/dark-mode.ts`'s original constants exactly. */
export const AUTO_DARK_DIAGRAM_THEME = 'zinc-dark'
export const AUTO_LIGHT_DIAGRAM_THEME = ''

/** `editor/js/init.ts`'s old retired-key migration target -- see #688. */
const LEGACY_THEME_STORAGE_KEY = 'bm-editor-theme'

/** Moved verbatim from `editor/js/init.ts` (deleted by this issue). */
export const DEFAULT_SOURCE =
  'graph TD\n  A[Start] --> B{Decision?}\n  B -->|Yes| C[Do the thing]\n  B -->|No| D[Skip it]\n  C --> E[End]\n  D --> E'

export interface UseEditorThemeArgs {
  state: EditorState
  dispatch: Dispatch<EditorAction>
  refs: { current: EditorRefs | null }
  themes: readonly EditorThemeItem[]
}

/**
 * Wires the theme dropdown, keeps the theme button + `zm-editor-theme-changed`
 * event in sync with `state.theme`, and runs the one-time client bootstrap
 * -- replacing `editor/js/theme-button.ts`'s and `editor/js/dark-mode.ts`'s/
 * `editor/js/init.ts`'s theme-related module-top-level equivalents. Call
 * once, unconditionally, from `<EditorApp>`'s own body, *after*
 * `useEditorRendering` (bootstrap calls `window.__editorRenderTrigger
 * .scheduleRender(0)`) and *after* `useEditorDarkMode` (bootstrap and the
 * dark-mode subscription both call `window.__editorDarkModeState.getIsDark()`
 * /`subscribe()`).
 */
export function useEditorTheme({
  state,
  dispatch,
  refs,
  themes,
}: UseEditorThemeArgs): void {
  const stateRef = useRef(state)
  stateRef.current = state

  // Theme button label/swatch + dropdown active-item -- editor/js/theme-button.ts's
  // old updateThemeButton(), reading the `themes` prop instead of the
  // `data-label-*` attributes that function scraped off the DOM (the same
  // data, sourced from the same editor.ts-built array either way).
  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return
    const key = state.theme
    const item = themes.find((t) => t.key === key)
    if (key && item) {
      r.themeBtnLabel.textContent = item.label
      r.themeBtnSwatch.style.background = item.bg
      r.themeBtnSwatch.style.display = ''
    } else {
      r.themeBtnLabel.textContent = 'Default'
      r.themeBtnSwatch.style.background = ''
      r.themeBtnSwatch.style.display = 'none'
    }
    r.themeMenu
      .querySelectorAll<HTMLElement>('.theme-dropdown-item')
      .forEach((el) => {
        el.classList.toggle('active', el.dataset.theme === key)
      })
  }, [state.theme, refs, themes])

  // zm-editor-theme-changed -- editor/js/state.ts's old setEditorTheme()
  // dispatch, now keyed off state.theme changing instead of being called
  // from every write site individually. See this file's header comment for
  // why editor-config.tsx needs no changes for this.
  useLayoutEffect(() => {
    window.dispatchEvent(
      new CustomEvent<string>(EDITOR_EFFECTIVE_THEME_EVENT, {
        detail: state.theme,
      }),
    )
  }, [state.theme])

  // Dropdown open/close + item click -- editor/js/init.ts's old
  // themeDropdownBtn/themeMenu/document click listeners.
  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return
    const onToggle = (e: Event) => {
      e.stopPropagation()
      const isOpen = r.themeMenu.classList.toggle('open')
      r.themeDropdownBtn.classList.toggle('open', isOpen)
    }
    const onMenuClick = (e: MouseEvent) => {
      const item =
        e.target instanceof Element
          ? e.target.closest<HTMLElement>('.theme-dropdown-item')
          : null
      if (!item) return
      // Persist + notify only -- this hook's own cross-tab subscribe effect
      // (registered below, always active by the time a real click can
      // happen) is what actually dispatches SET_THEME, the same
      // "setTheme() just persists+notifies, applyTheme() does the real
      // work" split editor/js/init.ts used.
      persistTheme(item.dataset.theme || '')
      r.themeMenu.classList.remove('open')
      r.themeDropdownBtn.classList.remove('open')
    }
    const onDocClick = (e: MouseEvent) => {
      if (
        !(e.target instanceof Node) ||
        !r.themeDropdownWrap.contains(e.target)
      ) {
        r.themeMenu.classList.remove('open')
        r.themeDropdownBtn.classList.remove('open')
      }
    }
    r.themeDropdownBtn.addEventListener('click', onToggle)
    r.themeMenu.addEventListener('click', onMenuClick)
    document.addEventListener('click', onDocClick)
    return () => {
      r.themeDropdownBtn.removeEventListener('click', onToggle)
      r.themeMenu.removeEventListener('click', onMenuClick)
      document.removeEventListener('click', onDocClick)
    }
  }, [refs])

  // One-time client bootstrap -- see this file's header comment for the
  // exact, order-dependent sequence this reproduces from editor/js/init.ts/
  // dark-mode.ts.
  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return

    // 1. Auto dark-mode-derived initial theme.
    let theme = getIsDark() ? AUTO_DARK_DIAGRAM_THEME : AUTO_LIGHT_DIAGRAM_THEME

    // 2. One-time bm-editor-theme -> shared mermaid-theme migration (#688).
    let legacy: string | null = null
    try {
      legacy = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY)
    } catch {
      // Storage unavailable (private mode, disabled) -- no migration to do.
    }
    const themesMap = readMermaidThemes()
    if (getTheme() === '' && legacy && themesMap?.[legacy]) {
      persistTheme(legacy)
    }
    try {
      window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY)
    } catch {
      // Ignore -- same "best effort" tolerance editor/js/init.ts had.
    }

    // 3. Restore the shared saved theme preference, if any.
    const saved = getTheme()
    if (saved && themesMap?.[saved]) {
      theme = saved
    }

    // 4. URL hash -- source text wins over the default diagram; a
    // hash-encoded theme (if any) wins over the saved preference above.
    const hash = parseHash(window.location.hash.slice(1))
    let sourceText: string
    if (hash) {
      sourceText = hash.source
      if (hash.theme) theme = hash.theme
    } else {
      sourceText = DEFAULT_SOURCE
    }

    // 5. Commit + trigger the first render. Only dispatch when the theme
    // actually differs from the reducer's initial value (`state` here is
    // this effect's own mount-time snapshot, accurate for a `[]`-deps
    // effect that only ever runs once) -- editor/js/state.ts's old
    // `setEditorTheme()` always wrote unconditionally, but every
    // downstream consumer (this hook's own theme-button-sync/
    // zm-editor-theme-changed effects, editor-rendering.ts's re-theme
    // effect) is itself keyed on the *value*, so a same-value dispatch has
    // no observable effect beyond an extra, functionally-inert re-render --
    // skipping it here avoids exactly that inert render, which is the one
    // this hydration test's own `act()` tracking doesn't reliably capture
    // (confirmed empirically while building this issue: an *unconditional*
    // dispatch here, even to the same '' default, triggered a stray "not
    // configured to support act(...)" warning in
    // `__tests__/dom/editor-hydration.test.ts`).
    if (theme !== state.theme) {
      dispatch({ type: 'SET_THEME', theme })
    }
    r.editor.value = sourceText
    // Optional chaining -- this bridge is always populated in practice by
    // the time this runs (see editor-rendering.ts's identical declaration
    // comment), but its type is optional so this file's ambient
    // declaration matches editor-config.tsx's/editor-rendering.ts's merged
    // one.
    window.__editorRenderTrigger?.scheduleRender(0)
    // `state` deliberately omitted: this effect must run exactly once (on
    // mount), reading `state.theme`'s initial-render value from its own
    // closure -- adding `state` here would re-run this "one-time bootstrap"
    // on every subsequent state change instead, since `state` is a new
    // object reference every render.
  }, [dispatch, refs])

  // Cross-tab/cross-page sync, and this tab's own dropdown picks (both
  // funnel through theme-state.ts's setTheme()/notify()) -- editor/js/init.ts's
  // old window.__themeState.subscribe(applyTheme), registered after the
  // bootstrap effect above for the ordering reason this file's header
  // comment explains.
  useLayoutEffect(() => {
    return subscribeThemeState((key) => {
      dispatch({ type: 'SET_THEME', theme: key })
    })
  }, [dispatch])

  // Dark/light toggle -- editor/js/dark-mode.ts's old
  // `window.__editorDarkModeState.subscribe((dark) => applyColorMode(dark, true))`,
  // `force: true` meaning *every* toggle re-derives the auto theme and wins
  // over any manually-picked theme (confirmed by reading that file's old
  // `applyColorMode` body -- not a guess).
  useLayoutEffect(() => {
    return subscribeDarkMode((dark) => {
      dispatch({
        type: 'SET_THEME',
        theme: dark ? AUTO_DARK_DIAGRAM_THEME : AUTO_LIGHT_DIAGRAM_THEME,
      })
    })
  }, [dispatch])
}
