/**
 * The preview panel's SVG/ASCII output toggle (zombie-mermaid#976,
 * following up on #976's own investigation issue). Adds a segmented
 * `SVG`/`ASCII` control to `editor-panels.tsx`'s `EditorRightPanel`
 * preview toolbar, mirroring the "Output" toggle the homepage's theme
 * showcase and hero panel already use (`index-page.tsx`'s
 * `.theme-showcase-output-segments`, `hero-output-panel.tsx`) -- same
 * `.output-segment`/`.output-segment.active` classes, wired here by a
 * dedicated hook the same shape `editor-tabs.ts`'s `useEditorTabs`
 * established for the Code/Config tab switcher (this control is a very
 * similar two-way segmented toggle).
 *
 * Unlike the homepage's toggles, this one drives a *live* re-render: the
 * editor's source text is arbitrary and user-edited, not a single
 * pre-rendered-at-build-time sample, so there's no pre-computed ASCII
 * string to swap in. `editor-rendering.ts`'s `doRender` reads
 * `state.outputMode` (written here) and, when it's `'ascii'`, calls
 * `window.__mermaid.renderMermaidASCII()` -- the exact same bridge object
 * `renderMermaidSVGAsync` already comes through, so this needs no new
 * import and adds no client bundle weight (see that file's header
 * comment). The theme-change effect in `useEditorRendering` also depends
 * on `state.outputMode` already, so toggling triggers a fresh render with
 * no extra wiring needed from this hook.
 *
 * This hook only owns: the two buttons' click listeners, their
 * `.active`/`aria-pressed` sync, and a `data-output-mode` attribute on
 * `refs.panelRight` -- `editor/css/preview.css` uses that attribute to
 * hide the zoom/pan controls while ASCII output is showing (zoom/pan act
 * on the rendered `<svg>` element, which doesn't exist in ASCII mode).
 */
import { useLayoutEffect, type Dispatch } from 'react'
import type { EditorAction, EditorRefs, EditorState } from './editor-app.tsx'

export interface UseEditorOutputModeArgs {
  state: EditorState
  dispatch: Dispatch<EditorAction>
  refs: { current: EditorRefs | null }
}

/**
 * Wires the preview panel's SVG/ASCII toggle buttons and syncs their
 * active state (plus `panelRight`'s `data-output-mode` attribute) with
 * `state.outputMode`. Call once, unconditionally, from `<EditorApp>`'s own
 * body.
 */
export function useEditorOutputMode({
  state,
  dispatch,
  refs,
}: UseEditorOutputModeArgs): void {
  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return
    const onSvg = () => dispatch({ type: 'SET_OUTPUT_MODE', mode: 'svg' })
    const onAscii = () => dispatch({ type: 'SET_OUTPUT_MODE', mode: 'ascii' })
    r.outputModeSvgBtn.addEventListener('click', onSvg)
    r.outputModeAsciiBtn.addEventListener('click', onAscii)
    return () => {
      r.outputModeSvgBtn.removeEventListener('click', onSvg)
      r.outputModeAsciiBtn.removeEventListener('click', onAscii)
    }
  }, [refs, dispatch])

  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return
    const isAscii = state.outputMode === 'ascii'
    r.outputModeSvgBtn.classList.toggle('active', !isAscii)
    r.outputModeSvgBtn.setAttribute('aria-pressed', String(!isAscii))
    r.outputModeAsciiBtn.classList.toggle('active', isAscii)
    r.outputModeAsciiBtn.setAttribute('aria-pressed', String(isAscii))
    r.panelRight.dataset.outputMode = state.outputMode
  }, [state.outputMode, refs])
}
