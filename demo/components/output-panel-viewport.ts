/**
 * Pan and zoom gestures for the "Source → render" output panel's *fullscreen*
 * view (`DetailOutputPanel` in `diagram-detail-app.tsx`) — scoped to
 * fullscreen only, by design: the small inline panel stays a static centered
 * preview, and this hook's listeners are only wired up while
 * `active` (that component's `isFullscreen`) is true.
 *
 * Unlike `editor-viewport.ts`'s pan (native `scrollLeft`/`scrollTop` on a
 * `overflow: auto` element), this hook drives a CSS `transform: translate()
 * scale()` on the content wrapper directly, because it also needs to support
 * two-finger touch pinch-to-zoom, which has no native-scroll equivalent.
 * Mouse drag, single-finger touch drag, and two-finger touch pinch are all
 * handled through one Pointer Event listener set (`pointerdown`/
 * `pointermove`/`pointerup`/`pointercancel`) rather than separate
 * `mouse*`/`touch*` listeners — each active finger (or the mouse) is just
 * another entry in the `pointers` map keyed by `pointerId`, and the gesture
 * (pan vs. pinch) is inferred purely from how many are currently down.
 *
 * Zoom always scales around the content's own center (the element's default
 * `transform-origin: 50% 50%`), not the cursor/pinch midpoint — a
 * deliberate simplification: cursor-anchored zoom needs the wrapper's
 * pre-transform layout position, which is expensive to keep correct across
 * resizes/orientation swaps for comparatively little payoff here. Panning is
 * still fully free-form and independent of zoom level (translate is applied
 * in fixed screen pixels, not scaled), so this reads as an ordinary
 * pan+zoom viewer even though zoom itself always re-centers.
 *
 * Trackpad convention: a plain two-finger swipe fires `wheel` events with no
 * modifier and is treated as pan; only `ctrl`/`cmd`+wheel (how browsers
 * already report trackpad pinch, and how `editor-viewport.ts`'s own
 * ctrl/cmd-wheel zoom works) is treated as zoom.
 */
import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

/** Mirrors `editor-viewport.ts`'s zoom clamp shape, tuned for this viewer (a rendered diagram, not the editor's own preview). */
export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 6
const ZOOM_STEP = 1.25
// The base editor-viewport.ts's own ctrl/cmd-wheel zoom uses (0.999) reads
// as sluggish here -- confirmed by hands-on feedback after shipping this
// feature -- so this viewer uses a stronger exponent instead of copying
// that constant verbatim. ~3x more responsive per unit of wheel deltaY
// (ln(0.997)/ln(0.999) ≈ 3): a single scroll-wheel notch (deltaY ~100-120)
// now changes zoom by roughly 26-30%, and a trackpad pinch or two-finger
// scroll (many small deltaY events) tracks noticeably faster too.
const WHEEL_ZOOM_SENSITIVITY = 0.997

export function clampZoom(scale: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, scale))
}

export interface OutputPanelViewport {
  scale: number
  tx: number
  ty: number
}

export const IDENTITY_VIEWPORT: OutputPanelViewport = { scale: 1, tx: 0, ty: 0 }

export interface ViewportPoint {
  x: number
  y: number
}

/** Euclidean distance between two active pointers — the pinch gesture's zoom signal. */
export function pointerDistance(a: ViewportPoint, b: ViewportPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Midpoint between two active pointers — the pinch gesture's pan signal. */
export function pointerMidpoint(
  a: ViewportPoint,
  b: ViewportPoint,
): ViewportPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** CSS `transform` value for a given viewport -- `undefined` at rest (`active: false`) so the normal (non-fullscreen) panel keeps its plain, untransformed layout. */
export function viewportTransform(
  viewport: OutputPanelViewport,
  active: boolean,
): string | undefined {
  if (!active) return undefined
  return `translate(${viewport.tx}px, ${viewport.ty}px) scale(${viewport.scale})`
}

export interface UseOutputPanelViewportArgs {
  /** Only wires gesture listeners (and reports a non-identity transform) while true. */
  active: boolean
  containerRef: RefObject<HTMLElement | null>
}

export interface UseOutputPanelViewportResult {
  viewport: OutputPanelViewport
  isPanning: boolean
  zoomIn(): void
  zoomOut(): void
  reset(): void
}

export function useOutputPanelViewport({
  active,
  containerRef,
}: UseOutputPanelViewportArgs): UseOutputPanelViewportResult {
  const [viewport, setViewport] =
    useState<OutputPanelViewport>(IDENTITY_VIEWPORT)
  const [isPanning, setIsPanning] = useState(false)
  // Lets the pointer/wheel listeners below (registered once per `active`
  // toggle, not on every viewport change) always read the latest viewport
  // when starting a new gesture -- editor-viewport.ts's own `stateRef`
  // pattern (see that file's header comment on why a plain per-render
  // assignment, not an effect, keeps this fresh without extra reruns).
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport

  // Entering or leaving the fullscreen view always starts from a clean
  // slate -- reopening fullscreen (or fullscreen already being open when a
  // different sample's markup swaps in) never begins from a stale pan/zoom
  // position left over from a previous session.
  useLayoutEffect(() => {
    setViewport(IDENTITY_VIEWPORT)
    setIsPanning(false)
  }, [active])

  useLayoutEffect(() => {
    if (!active) return
    const el = containerRef.current
    if (!el) return

    const pointers = new Map<number, ViewportPoint>()
    let panStart: { x: number; y: number; tx: number; ty: number } | null = null
    let pinchStart: {
      dist: number
      mid: ViewportPoint
      scale: number
      tx: number
      ty: number
    } | null = null

    // (Re)snapshots the in-progress gesture from whatever pointers are
    // currently down -- called both on a fresh pointerdown and when a
    // pinch drops back to a single finger, so the remaining finger keeps
    // panning from exactly where it already was instead of jumping.
    const beginGesture = () => {
      panStart = null
      pinchStart = null
      const [p0, p1] = pointers.values()
      if (p0 !== undefined && p1 !== undefined) {
        pinchStart = {
          dist: pointerDistance(p0, p1),
          mid: pointerMidpoint(p0, p1),
          scale: viewportRef.current.scale,
          tx: viewportRef.current.tx,
          ty: viewportRef.current.ty,
        }
      } else if (p0 !== undefined) {
        panStart = {
          x: p0.x,
          y: p0.y,
          tx: viewportRef.current.tx,
          ty: viewportRef.current.ty,
        }
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      try {
        // jsdom (this repo's DOM test environment) implements no
        // setPointerCapture at all -- see __tests__/dom/output-panel-
        // viewport.test.ts's header comment -- so this stays optional
        // chaining rather than a hard dependency real browsers all
        // provide. Even where it exists, a real browser can still throw
        // `NotFoundError` ("no active pointer with the given id") for a
        // pointerId it doesn't recognize as currently active -- confirmed
        // live in Chrome while building this feature -- so this call is
        // wrapped rather than left to abort the rest of this handler
        // (which would otherwise silently drop the pointer and never
        // start the gesture at all).
        el.setPointerCapture?.(e.pointerId)
      } catch {
        // Capture is a nice-to-have (keeps receiving move/up events if the
        // pointer strays outside `el`'s bounds) -- losing it doesn't stop
        // the gesture below from working, just makes it slightly less
        // forgiving about leaving the element mid-drag.
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      beginGesture()
      setIsPanning(true)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const [a, b] = pointers.values()
      if (pinchStart && a !== undefined && b !== undefined) {
        const dist = pointerDistance(a, b)
        const mid = pointerMidpoint(a, b)
        const start = pinchStart
        setViewport({
          scale: clampZoom(start.scale * (dist / start.dist)),
          tx: start.tx + (mid.x - start.mid.x),
          ty: start.ty + (mid.y - start.mid.y),
        })
      } else if (panStart && a !== undefined && b === undefined) {
        const p = a
        const start = panStart
        setViewport((v) => ({
          ...v,
          tx: start.tx + (p.x - start.x),
          ty: start.ty + (p.y - start.y),
        }))
      }
    }

    const endPointer = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      pointers.delete(e.pointerId)
      if (pointers.size === 0) {
        setIsPanning(false)
      }
      // Restart from whatever's left (one finger, or none) rather than
      // just clearing -- see beginGesture's own comment.
      beginGesture()
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', endPointer)
    el.addEventListener('pointercancel', endPointer)

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        // ZOOM_STEP-style continuous factor, not a precomputed SET -- a
        // fast trackpad pinch can queue several wheel events before a
        // render, the same hazard editor-viewport.ts's own ZOOM_BY_FACTOR
        // doc comment describes.
        setViewport((v) => ({
          ...v,
          scale: clampZoom(
            v.scale * Math.pow(WHEEL_ZOOM_SENSITIVITY, e.deltaY),
          ),
        }))
      } else {
        setViewport((v) => ({ ...v, tx: v.tx - e.deltaX, ty: v.ty - e.deltaY }))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })

    const onDoubleClick = () => setViewport(IDENTITY_VIEWPORT)
    el.addEventListener('dblclick', onDoubleClick)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', endPointer)
      el.removeEventListener('pointercancel', endPointer)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('dblclick', onDoubleClick)
    }
  }, [active, containerRef])

  return {
    viewport,
    isPanning,
    zoomIn: () =>
      setViewport((v) => ({ ...v, scale: clampZoom(v.scale * ZOOM_STEP) })),
    zoomOut: () =>
      setViewport((v) => ({ ...v, scale: clampZoom(v.scale / ZOOM_STEP) })),
    reset: () => setViewport(IDENTITY_VIEWPORT),
  }
}
