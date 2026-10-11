/**
 * Framework-free pinch/wheel-zoom gesture math shared between
 * `output-panel-viewport.ts` (a React hook powering `DetailOutputPanel`'s
 * fullscreen "Source → render" viewer) and `index-page-client.ts` (the
 * homepage's theme-showcase card, which drives the identical fullscreen
 * pinch/pan/wheel-zoom gesture over its own `#theme-showcase-output-body`).
 *
 * This file has zero imports, deliberately: `index-page-client.ts` is a
 * hand-bundled, deliberately React-free vanilla-JS file (see that file's
 * own header comment), and `output-panel-viewport.ts` is a React hook
 * whose top-level `import ... from 'react'` would drag React into that
 * bundle the moment anything is imported from it -- even just these pure
 * functions. Before this file existed, that constraint meant
 * `index-page-client.ts` hand-copied this exact math rather than importing
 * it (zombie-mermaid#988); this module is the zero-dependency seam that
 * lets both sides import the same code instead.
 */

export interface GesturePoint {
  x: number
  y: number
}

/** Euclidean distance between two active pointers -- the pinch gesture's zoom signal. */
export function pointerDistance(a: GesturePoint, b: GesturePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Midpoint between two active pointers -- the pinch gesture's pan signal. */
export function pointerMidpoint(
  a: GesturePoint,
  b: GesturePoint,
): GesturePoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/**
 * Clamps `scale` to `[min, max]`. Parameterized rather than baking in a
 * fixed range because each caller owns a different one:
 * `output-panel-viewport.ts`'s fullscreen diagram viewer uses
 * `[ZOOM_MIN, ZOOM_MAX]` (0.25-6), while `index-page-client.ts`'s
 * theme-showcase card uses its own, narrower `[SCALE_MIN, SCALE_MAX]`
 * (0.5-2.5, zombie-mermaid#987).
 */
export function clampZoom(scale: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, scale))
}

/**
 * Discrete zoom step used by both callers' +/- zoom buttons -- e.g.
 * `nextScale = currentScale * ZOOM_STEP` (or `/ ZOOM_STEP` to zoom out).
 */
export const ZOOM_STEP = 1.25

/**
 * Trackpad ctrl/cmd-wheel zoom sensitivity, applied as
 * `Math.pow(WHEEL_ZOOM_SENSITIVITY, e.deltaY)`. A naive 1:1 `deltaY` reads
 * as sluggish for this gesture -- confirmed by hands-on feedback after
 * shipping `output-panel-viewport.ts`'s fullscreen viewer, the original
 * home of this constant -- so both callers use this stronger exponent
 * instead. ~3x more responsive than `editor-viewport.ts`'s own base
 * ctrl/cmd-wheel zoom sensitivity (0.999) per unit of wheel deltaY
 * (ln(0.997)/ln(0.999) ≈ 3): a single scroll-wheel notch (deltaY ~100-120)
 * changes zoom by roughly 26-30%, and a trackpad pinch or two-finger
 * scroll (many small deltaY events) tracks noticeably faster too.
 */
export const WHEEL_ZOOM_SENSITIVITY = 0.997
