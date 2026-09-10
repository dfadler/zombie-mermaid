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
 * bootstrap effect below reproduces that sequence, since later steps depend
 * on earlier ones (a URL-hash theme overrides a saved theme, which overrides
 * the dark-mode-derived default):
 *
 * 1. Derive an initial diagram theme from dark/light mode (old
 *    `dark-mode.ts` module-top-level `applyColorMode(getIsDark())`).
 * 2. Restore this editor's own saved theme preference, if any (overrides
 *    step 1) -- see "Local, not shared" below for what this reads.
 * 3. Parse the URL hash, if any -- its source text wins over the default
 *    diagram, and its theme (if present) wins over step 2. *Any* hash
 *    source at all -- even one with no theme in it -- permanently disables
 *    the dark-mode-driven auto-theme for the rest of the session, matching
 *    `editor/js/init.ts`'s old unconditional `setDiagramThemeIsAuto(false)`
 *    inside its `if (hashSource)` branch.
 * 4. Dispatch the final theme once and set the textarea's initial value,
 *    then trigger the first render.
 *
 * `editor/js/editor-helpers.ts` (still legacy, not migrated by this issue)
 * calls `updateLineNumbers()` once at its own module top level now, reading
 * the `refs.editor.value` this bootstrap effect already set -- see that
 * file's header comment. It couldn't be done here: that function doesn't
 * exist yet when this effect runs (the legacy bundle only loads *after*
 * `<EditorApp>` finishes hydrating -- see `editor-app.tsx`'s
 * `EDITOR_HYDRATED_EVENT` doc comment).
 *
 * ## Local, not shared (post-#810 amendment)
 *
 * This hook originally persisted the diagram theme through `demo/theme-
 * state.ts`'s shared `mermaid-theme` `localStorage` key -- the same key
 * every other page (home, blog, dashboard, diagram pages) reads/writes --
 * and subscribed to that module's cross-tab `storage`-event sync, per
 * #688's "reconciled, not kept separate" decision (`docs/decisions/theme-
 * selector-shared-state.md`). That meant picking a theme in the editor
 * changed every other open tab of the site, and vice versa -- a "global"
 * side effect well beyond this editor's own diagram. That amendment is now
 * itself amended (see the ADR): the editor's diagram theme is local again,
 * under its own `bm-editor-theme` key (the same key #688 originally
 * retired), read/written directly by {@link getPersistedTheme}/
 * {@link persistTheme} below -- no shared module, no cross-tab listener, no
 * migration. A theme picked elsewhere on the site no longer reaches this
 * editor, and picking one here no longer reaches anywhere else.
 */
import { useLayoutEffect, useRef, type Dispatch } from 'react'
import {
  getIsDark,
  subscribe as subscribeDarkMode,
} from '../editor-dark-mode-state.ts'
import type { EditorAction, EditorRefs, EditorState } from './editor-app.tsx'
import { parseHash } from './editor-sharing.ts'
import type { EditorThemeItem } from './editor-topbar.tsx'
import { readMermaidThemes } from './editor-rendering.ts'

/** Duplicated verbatim in `editor-config.tsx` -- see that file's header comment for why the string can't just be imported from there (separate concern, no runtime coupling intended). */
export const EDITOR_EFFECTIVE_THEME_EVENT = 'zm-editor-theme-changed'

/** Mirrors `editor/js/dark-mode.ts`'s original constants exactly. */
export const AUTO_DARK_DIAGRAM_THEME = 'zinc-dark'
export const AUTO_LIGHT_DIAGRAM_THEME = ''

/**
 * This editor's own diagram-theme preference key -- local to the editor,
 * not shared with the rest of the site (`demo/theme-state.ts`'s
 * `mermaid-theme` key). See this file's header comment, "Local, not
 * shared."
 */
const THEME_STORAGE_KEY = 'bm-editor-theme'

/** Reads {@link THEME_STORAGE_KEY}, defaulting to `''` (no preference) whenever nothing is stored, storage is unavailable, or reading it throws. */
function getPersistedTheme(): string {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

/** Persists `themeKey` under {@link THEME_STORAGE_KEY} (clearing it for `''`), ignoring write failures (quota exceeded, private-mode restrictions) -- this tab's own state is never gated on persistence succeeding. */
function persistTheme(themeKey: string): void {
  try {
    if (themeKey) {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeKey)
    } else {
      window.localStorage.removeItem(THEME_STORAGE_KEY)
    }
  } catch {
    // Ignore write failures -- see doc comment above.
  }
}

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
      const key = item.dataset.theme || ''
      // Persist locally (this editor only, see this file's header comment)
      // and dispatch directly -- no shared module/cross-tab listener sits
      // between a click and the state update anymore.
      persistTheme(key)
      dispatch({ type: 'SET_THEME', theme: key })
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
  }, [refs, dispatch])

  // One-time client bootstrap -- see this file's header comment for the
  // exact, order-dependent sequence this reproduces from editor/js/init.ts/
  // dark-mode.ts.
  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return

    // 1. Auto dark-mode-derived initial theme.
    let theme = getIsDark() ? AUTO_DARK_DIAGRAM_THEME : AUTO_LIGHT_DIAGRAM_THEME

    // 2. Restore this editor's own saved theme preference, if any -- see
    // this file's header comment, "Local, not shared."
    const themesMap = readMermaidThemes()
    const saved = getPersistedTheme()
    if (saved && themesMap?.[saved]) {
      theme = saved
    }

    // 3. URL hash -- source text wins over the default diagram; a
    // hash-encoded theme (if any) wins over the saved preference above.
    const hash = parseHash(window.location.hash.slice(1))
    let sourceText: string
    if (hash) {
      sourceText = hash.source
      if (hash.theme) theme = hash.theme
    } else {
      sourceText = DEFAULT_SOURCE
    }

    // 4. Commit + trigger the first render. Only dispatch when the theme
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
