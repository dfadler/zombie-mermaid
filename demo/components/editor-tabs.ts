/**
 * The Code/Config tab switcher as React state (zombie-mermaid#809, one
 * slice of the #797 editor rewrite). Replaces `editor/js/tabs.ts`'s
 * top-level `document.querySelectorAll('.tab').forEach(...)` click wiring
 * and its implicit "whichever `.tab` has `.active`" state with
 * `editor-app.tsx`'s reducer (`state.activeTab`) and {@link useEditorTabs},
 * called directly from `<EditorApp>`'s own body -- the same shape
 * `editor-viewport.ts`'s `useEditorViewport` established for #807.
 *
 * ## The `window.__editorTabsState` bridge
 *
 * `editor/js/tabs.ts` (not deleted outright, unlike `zoom.ts`/`pan.ts`/
 * `resize.ts` in #807) still has exactly one job: call
 * `refreshAllColorUIs()` (`editor/js/config-panel.ts`, not migrated to
 * React until #808) whenever the Config tab becomes active -- the legacy
 * code's `if (panel !== 'code') refreshAllColorUIs()`. Since `config-panel.ts`
 * isn't React-owned yet, this hook can't call it directly (`demo/components/
 * *.tsx` deliberately never reaches into `editor/js/*.ts` -- see
 * `editor-app.tsx`'s `requireEditorElement` doc comment for the two
 * independent-programs rationale), so it publishes which tab is active on
 * `window.__editorTabsState` and the (now much smaller) legacy `tabs.ts`
 * subscribes, mirroring the existing `window.__editorViewportState`/
 * `window.__themeState` bridge convention. See `editor/js/global.d.ts` for
 * that program's ambient declaration of this shape.
 */
import { useLayoutEffect, useRef, type Dispatch } from 'react'
import type { EditorAction, EditorRefs, EditorState } from './editor-app.tsx'

declare global {
  interface Window {
    __editorTabsState: {
      getActiveTab(): 'code' | 'config' | 'preview'
      subscribe(
        listener: (tab: 'code' | 'config' | 'preview') => void,
      ): () => void
    }
  }
}

/** Resolves a `.tab` element's `data-panel` to one of the three valid tab
 * values, matching `editor-topbar.tsx`'s three `data-panel` attributes
 * (`"code"`/`"config"`/`"preview"`) and defaulting to `'code'` the same way
 * the original two-tab code did for anything unrecognized. */
function resolveTabPanel(tab: HTMLElement): 'code' | 'config' | 'preview' {
  if (tab.dataset.panel === 'config') return 'config'
  if (tab.dataset.panel === 'preview') return 'preview'
  return 'code'
}

export interface UseEditorTabsArgs {
  state: EditorState
  dispatch: Dispatch<EditorAction>
  refs: { current: EditorRefs | null }
}

/**
 * Wires the Code/Config tab buttons and syncs the two panels' visibility
 * with `state.activeTab` -- replacing `editor/js/tabs.ts`'s module-top-level
 * equivalent. Call once, unconditionally, from `<EditorApp>`'s own body.
 */
export function useEditorTabs({
  state,
  dispatch,
  refs,
}: UseEditorTabsArgs): void {
  const listeners = useRef(
    new Set<(tab: 'code' | 'config' | 'preview') => void>(),
  )
  const stateRef = useRef(state)
  stateRef.current = state

  // The window.__editorTabsState bridge for editor/js/tabs.ts -- see this
  // file's header comment.
  useLayoutEffect(() => {
    window.__editorTabsState = {
      getActiveTab: () => stateRef.current.activeTab,
      subscribe(listener) {
        listeners.current.add(listener)
        return () => listeners.current.delete(listener)
      },
    }
  }, [])

  // Tab button clicks -- editor/js/tabs.ts's old per-`.tab` click listeners.
  // Queried generically via `.tab` (not individual refs) to match the
  // original code's own generic `querySelectorAll('.tab')` wiring exactly.
  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return
    const tabs = document.querySelectorAll<HTMLElement>('.tab')
    const onClick = (tab: HTMLElement) => () => {
      const panel = resolveTabPanel(tab)
      dispatch({ type: 'SET_ACTIVE_TAB', tab: panel })
      for (const listener of listeners.current) listener(panel)
    }
    const handlers = new Map<HTMLElement, () => void>()
    tabs.forEach((tab) => {
      const handler = onClick(tab)
      handlers.set(tab, handler)
      tab.addEventListener('click', handler)
    })
    return () => {
      handlers.forEach((handler, tab) => {
        tab.removeEventListener('click', handler)
      })
    }
  }, [refs, dispatch])

  // Sync the active tab's `.active` class, panel visibility, and the
  // source toolbar's visibility with state.activeTab -- editor/js/tabs.ts's
  // old click-listener body.
  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return
    document.querySelectorAll<HTMLElement>('.tab').forEach((tab) => {
      tab.classList.toggle('active', resolveTabPanel(tab) === state.activeTab)
    })
    // 'preview' deliberately falls through without touching
    // editorView/configView/sourceToolbar: it's a narrow-viewport-only tab
    // that swaps which of .panel-left/.panel-right is visible (see
    // editor-app.tsx's data-active-tab and editor/css/panels.css's mobile
    // media query) -- .panel-left itself is display:none at that width, so
    // whichever of Code/Config was showing inside it stays exactly as it
    // was, unaffected by Preview being selected. 'code'/'config' keep
    // their original, unchanged behavior at every width.
    if (state.activeTab === 'code') {
      r.editorView.style.display = 'flex'
      r.configView.classList.remove('visible')
      r.sourceToolbar.style.display = ''
    } else if (state.activeTab === 'config') {
      r.editorView.style.display = 'none'
      r.configView.classList.add('visible')
      r.sourceToolbar.style.display = 'none'
    }
  }, [state.activeTab, refs])
}
