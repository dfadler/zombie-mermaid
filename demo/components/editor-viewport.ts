/**
 * Zoom, pan, and panel-resize as React state (zombie-mermaid#807) -- the
 * diagram-canvas-viewport slice of the #797 editor rewrite. Replaces
 * `editor/js/zoom.ts`, `editor/js/pan.ts`, and `editor/js/resize.ts`'s
 * module-top-level `addEventListener` wiring and module-level mutable
 * variables (`state.zoom`, `panActive`, `panStart`, `isResizing`, ...) with
 * `editor-app.tsx`'s reducer and {@link useEditorViewport}, a hook called
 * directly from `<EditorApp>`'s own body (see that file's `EditorApp`
 * function) -- not a mounted child component, so there's no need to thread
 * these effects through the `EditorRefsContext`/`EditorDispatchContext`
 * providers and no circular import between this file and `editor-app.tsx`
 * (this file only imports *types* from there).
 *
 * `editor/js/elements.ts`'s three viewport ids (`resize-handle`,
 * `panel-left`, plus zoom/pan's own four button ids) were already part of
 * `editor-app.tsx`'s `EditorRefs`/`collectEditorRefs()` (added by this
 * issue) -- see that file for the rest.
 *
 * ## Why `useLayoutEffect`, not `useEffect`
 *
 * {@link useEditorViewport} is called from `<EditorApp>`'s own body, *after*
 * the `useLayoutEffect` that populates `refs.current` and dispatches
 * `EDITOR_HYDRATED_EVENT` (see `editor-app.tsx`'s header comment on hook
 * call order determining layout-effect flush order within one component).
 * Every effect below is therefore also a `useLayoutEffect`: React flushes a
 * single component's layout effects in the order they were registered,
 * synchronously within the same commit, so `refs.current` is guaranteed
 * non-null by the time any of these run -- no need for the "wait for the
 * whole tree" plain-`useEffect` fallback `editor-app.tsx`'s header comment
 * describes for a *descendant* component (this isn't one). Using
 * `useLayoutEffect` (not `useEffect`) also means a zoom/pan/resize DOM sync
 * (e.g. `applyZoomToDom`) commits before the browser paints, matching the
 * legacy code's synchronous-write feel exactly.
 *
 * ## The `window.__editorViewportState` bridge
 *
 * `editor/js/rendering.ts` (not ported to React until #810) calls
 * `applyZoom(state.zoom)` after every `doRender()` swaps a freshly-rendered
 * SVG into `#preview-inner`, to reapply the *current* zoom level to the new
 * SVG. Now that zoom is React state owned by `<EditorApp>`'s reducer,
 * `rendering.ts` -- a plain script with no access to React state or
 * context -- can't reach it directly. `useEditorViewport` instead exposes
 * a minimal bridge on `window.__editorViewportState`, mirroring the
 * existing `window.__mermaid` (`src/browser.ts`) / `window.__themeState`
 * (`demo/editor-theme-state-bridge.ts`) convention: `rendering.ts` calls
 * `window.__editorViewportState.applyZoom()` instead of importing
 * `applyZoom` from the now-deleted `editor/js/zoom.ts`. See
 * `editor/js/global.d.ts` for that program's ambient declaration of this
 * shape.
 *
 * The bridge closes over a `stateRef` kept fresh every render (a plain
 * assignment in `useEditorViewport`'s body, not an effect -- a standard
 * React pattern for giving a stable closure access to the latest render's
 * value without re-running effects on every state change) rather than
 * being re-registered whenever `state.zoom` changes, so its identity is
 * stable and this doesn't add `state` to any effect's dependency array.
 */
import { useLayoutEffect, useRef, type Dispatch } from 'react'
import type { EditorAction, EditorRefs, EditorState } from './editor-app.tsx'

/** Mirrors `editor/js/zoom.ts`'s original clamp range exactly. */
export const ZOOM_MIN = 0.1
export const ZOOM_MAX = 8

export function clampZoom(zoom: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom))
}

/** Moved verbatim from `editor/js/zoom.ts` (deleted by this issue). */
export function getSvgNaturalSize(svgEl: SVGSVGElement): {
  w: number
  h: number
} {
  const vb = svgEl.viewBox && svgEl.viewBox.baseVal
  if (vb && vb.width > 0 && vb.height > 0) return { w: vb.width, h: vb.height }
  const w =
    parseFloat(svgEl.getAttribute('width') || '') ||
    svgEl.getBoundingClientRect().width ||
    400
  const h =
    parseFloat(svgEl.getAttribute('height') || '') ||
    svgEl.getBoundingClientRect().height ||
    300
  return { w: w, h: h }
}

/**
 * Pure-ish DOM-mutation step: writes `zoom` onto the currently-rendered SVG
 * (if any) and the zoom label -- `editor/js/zoom.ts`'s old `applyZoom` body,
 * minus the `state.zoom` assignment (the reducer owns that now). Exported
 * for the `window.__editorViewportState` bridge and for direct testing,
 * mirroring `editor-app.tsx`'s `collectEditorRefs` "small pure/DOM-query
 * function, exported for direct testing" precedent.
 */
export function applyZoomToDom(refs: EditorRefs | null, zoom: number): void {
  if (!refs) return
  const svgEl = refs.previewInner.querySelector<SVGSVGElement>('svg')
  if (svgEl) {
    const nat = getSvgNaturalSize(svgEl)
    svgEl.style.width = nat.w * zoom + 'px'
    svgEl.style.height = nat.h * zoom + 'px'
    svgEl.style.transform = ''
  }
  refs.zoomLabel.textContent = Math.round(zoom * 100) + '%'
}

/** Mirrors `editor/js/resize.ts`'s original constants exactly. */
export const PANEL_RESIZE_MIN_WIDTH = 280
export const PANEL_RESIZE_MAX_WIDTH_RATIO = 0.75

export function clampPanelWidth(
  width: number,
  windowInnerWidth: number,
): number {
  return Math.max(
    PANEL_RESIZE_MIN_WIDTH,
    Math.min(windowInnerWidth * PANEL_RESIZE_MAX_WIDTH_RATIO, width),
  )
}

declare global {
  interface Window {
    __editorViewportState: {
      getZoom(): number
      applyZoom(): void
    }
  }
}

/** Constructor args for {@link useEditorViewport} -- the exact `state`, `dispatch`, and `refs` `<EditorApp>` already holds locally in its own body. */
export interface UseEditorViewportArgs {
  state: EditorState
  dispatch: Dispatch<EditorAction>
  refs: { current: EditorRefs | null }
}

/**
 * Wires zoom, pan, and panel-resize event listeners onto the real DOM
 * elements in `refs`, driving them through `dispatch` -- replacing
 * `editor/js/zoom.ts`'s, `pan.ts`'s, and `resize.ts`'s module-top-level
 * equivalents. Call once, unconditionally, from `<EditorApp>`'s own body
 * (after its ref-collecting `useLayoutEffect` -- see this file's header
 * comment for why call order matters).
 */
export function useEditorViewport({
  state,
  dispatch,
  refs,
}: UseEditorViewportArgs): void {
  const stateRef = useRef(state)
  stateRef.current = state

  // The window.__editorViewportState bridge for editor/js/rendering.ts --
  // see this file's header comment.
  useLayoutEffect(() => {
    window.__editorViewportState = {
      getZoom: () => stateRef.current.zoom,
      applyZoom: () => applyZoomToDom(refs.current, stateRef.current.zoom),
    }
  }, [refs])

  // Sync the rendered SVG + zoom label whenever state.zoom changes (button
  // clicks, wheel-zoom, or the bridge's applyZoom() reapplying it after a
  // fresh render) -- editor/js/zoom.ts's old applyZoom() DOM-write half.
  useLayoutEffect(() => {
    applyZoomToDom(refs.current, state.zoom)
  }, [state.zoom, refs])

  // Zoom in/out/fit buttons -- editor/js/zoom.ts's old click listeners.
  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return
    // ZOOM_BY_FACTOR (not a precomputed SET_ZOOM) -- see that action's doc
    // comment in editor-app.tsx for why: a caller-computed
    // `stateRef.current.zoom * 1.25` doesn't compound correctly across
    // rapid clicks with no render in between.
    const zoomIn = () => dispatch({ type: 'ZOOM_BY_FACTOR', factor: 1.25 })
    const zoomOut = () => dispatch({ type: 'ZOOM_BY_FACTOR', factor: 1 / 1.25 })
    const zoomFit = () => dispatch({ type: 'SET_ZOOM', zoom: 1 })
    r.zoomInBtn.addEventListener('click', zoomIn)
    r.zoomOutBtn.addEventListener('click', zoomOut)
    r.zoomFitBtn.addEventListener('click', zoomFit)
    return () => {
      r.zoomInBtn.removeEventListener('click', zoomIn)
      r.zoomOutBtn.removeEventListener('click', zoomOut)
      r.zoomFitBtn.removeEventListener('click', zoomFit)
    }
  }, [refs, dispatch])

  // Pan toggle button, drag mechanics, and ctrl/cmd-wheel zoom --
  // editor/js/pan.ts's old listeners.
  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return
    let panStart: { x: number; y: number; sl: number; st: number } | null = null

    const togglePan = () => dispatch({ type: 'TOGGLE_PAN_ACTIVE' })

    const onMouseDown = (e: MouseEvent) => {
      const shouldPan = stateRef.current.panActive || e.metaKey || e.ctrlKey
      if (!shouldPan || e.button !== 0) return
      e.preventDefault()
      panStart = {
        x: e.clientX,
        y: e.clientY,
        sl: r.previewBody.scrollLeft,
        st: r.previewBody.scrollTop,
      }
      dispatch({ type: 'SET_PANNING', panning: true })
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!panStart) return
      const dx = e.clientX - panStart.x
      const dy = e.clientY - panStart.y
      r.previewBody.scrollLeft = panStart.sl - dx
      r.previewBody.scrollTop = panStart.st - dy
    }
    const onMouseUp = () => {
      if (!panStart) return
      panStart = null
      dispatch({ type: 'SET_PANNING', panning: false })
    }
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      // ZOOM_BY_FACTOR here too -- a fast trackpad/wheel stream can queue
      // several wheel events before a render, the same hazard the zoom
      // buttons have (see that action's doc comment in editor-app.tsx).
      dispatch({ type: 'ZOOM_BY_FACTOR', factor: Math.pow(0.999, e.deltaY) })
    }

    r.panBtn.addEventListener('click', togglePan)
    r.previewBody.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    r.previewBody.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      r.panBtn.removeEventListener('click', togglePan)
      r.previewBody.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      r.previewBody.removeEventListener('wheel', onWheel)
    }
  }, [refs, dispatch])

  // Sync pan-mode/panning classes with state.
  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return
    r.panBtn.classList.toggle('active', state.panActive)
    r.previewBody.classList.toggle('pan-mode', state.panActive)
  }, [state.panActive, refs])

  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return
    r.previewBody.classList.toggle('panning', state.isPanning)
  }, [state.isPanning, refs])

  // Panel-resize drag mechanics -- editor/js/resize.ts's old listeners.
  //
  // The in-progress check below is a plain local `isResizing` boolean (set
  // synchronously in onMouseDown, mirroring editor/js/resize.ts's own
  // module-level `isResizing` variable), *not* `stateRef.current
  // .isResizingPanel` -- confirmed by real-browser testing while building
  // this PR that using the state-derived value here is a genuine race:
  // `dispatch()` from a plain native event listener (this isn't a React
  // `onClick`) doesn't re-render synchronously, so a `mousemove` that
  // arrives before React has flushed the `mousedown` handler's
  // `SET_RESIZING_PANEL` dispatch would see a stale `false` and silently
  // drop the drag. `onMouseDown`'s pan equivalent (`panStart`, above)
  // already used a local variable for the identical reason; this effect
  // originally didn't and the resize handle was unresponsive as a result.
  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return
    let isResizing = false
    let resizeStartX = 0
    let resizeStartW = 0
    const onMouseDown = (e: MouseEvent) => {
      isResizing = true
      resizeStartX = e.clientX
      resizeStartW = r.panelLeft.getBoundingClientRect().width
      dispatch({ type: 'SET_RESIZING_PANEL', resizing: true })
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      const dx = e.clientX - resizeStartX
      const newW = clampPanelWidth(resizeStartW + dx, window.innerWidth)
      dispatch({ type: 'SET_PANEL_LEFT_WIDTH', width: newW })
    }
    const onMouseUp = () => {
      if (!isResizing) return
      isResizing = false
      dispatch({ type: 'SET_RESIZING_PANEL', resizing: false })
    }
    r.resizeHandle.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      r.resizeHandle.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [refs, dispatch])

  // Apply the committed panel width to the DOM.
  useLayoutEffect(() => {
    const r = refs.current
    if (!r || state.panelLeftWidth == null) return
    r.panelLeft.style.width = state.panelLeftWidth + 'px'
  }, [state.panelLeftWidth, refs])

  // Sync the resize-handle's dragging class + document cursor/selection.
  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return
    r.resizeHandle.classList.toggle('dragging', state.isResizingPanel)
    document.body.style.cursor = state.isResizingPanel ? 'col-resize' : ''
    document.body.style.userSelect = state.isResizingPanel ? 'none' : ''
  }, [state.isResizingPanel, refs])
}
