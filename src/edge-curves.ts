// ============================================================================
// zombie-mermaid — edge path interpolation (Mermaid's `flowchart.curve`)
//
// ELK routes an edge as a list of bend points. How those points are joined
// into a drawn line is a separate, purely presentational choice, which
// Mermaid exposes as `%%{init: {"flowchart": {"curve": "basis"}}}%%`.
//
// Every curve here consumes the same routed points, so switching styles never
// changes where an edge goes — only how it looks getting there.
// ============================================================================

import type { Point } from './types.ts'
import type { CurveStyle } from './init-directive.ts'

/** `M x y` for the first point. */
function moveTo(p: Point): string {
  return `M ${p.x} ${p.y}`
}

/** Straight segments through every point — the historical default. */
function linearPath(points: Point[]): string {
  return (
    moveTo(points[0]!) +
    points
      .slice(1)
      .map((p) => ` L ${p.x} ${p.y}`)
      .join('')
  )
}

/**
 * Uniform cubic B-spline, matching d3's `curveBasis` (what Mermaid uses for
 * `basis`).
 *
 * A B-spline is *approximating*, not interpolating: it passes through neither
 * the interior points nor, without the endpoint handling below, the ends. The
 * first and last points are therefore emitted explicitly so an edge still
 * touches the nodes it connects — otherwise it would visibly detach.
 *
 * This is a direct port of d3's `Basis` curve rather than a lookalike, so a
 * diagram rendered here traces the same path Mermaid would draw. For each
 * point d3 emits one cubic whose controls are the thirds between the two
 * preceding points and whose end is the B-spline knot `(p0 + 4p1 + p2) / 6`;
 * it leads in at `(5p0 + p1) / 6` and closes with a final cubic against a
 * repeated last point, then a line to it.
 */
function basisPath(points: Point[]): string {
  if (points.length < 3) return linearPath(points)

  const last = points[points.length - 1]!
  const parts: string[] = [moveTo(points[0]!)]

  /** One B-spline segment across three successive control points. */
  const segment = (p0: Point, p1: Point, p2: Point): string =>
    ` C ${(2 * p0.x + p1.x) / 3} ${(2 * p0.y + p1.y) / 3},` +
    ` ${(p0.x + 2 * p1.x) / 3} ${(p0.y + 2 * p1.y) / 3},` +
    ` ${(p0.x + 4 * p1.x + p2.x) / 6} ${(p0.y + 4 * p1.y + p2.y) / 6}`

  // Lead-in to the first knot, one sixth of the way along the opening leg.
  parts.push(
    ` L ${(5 * points[0]!.x + points[1]!.x) / 6}` +
      ` ${(5 * points[0]!.y + points[1]!.y) / 6}`,
  )

  for (let i = 2; i < points.length; i++) {
    parts.push(segment(points[i - 2]!, points[i - 1]!, points[i]!))
  }

  // d3 closes by feeding the last point twice, then drawing to it.
  parts.push(segment(points[points.length - 2]!, last, last))
  parts.push(` L ${last.x} ${last.y}`)

  return parts.join('')
}

/**
 * Straight runs joined by rounded corners. Mermaid calls this `natural`.
 *
 * NOTE: this is deliberately *not* d3's interpolating natural cubic spline.
 * ELK routes edges orthogonally, so every bend is a right angle, and at a
 * right angle the tangent of any C1-smooth interpolating spline is the
 * average of the two segment directions — i.e. diagonal. The curve must then
 * arrive at the corner travelling diagonally while approaching from directly
 * above, so it bulges sideways past the straight line. Two mirrored edges
 * leaving one decision node turned that bulge into a visible teardrop loop.
 * Scaling the tangents down shrinks the overshoot but cannot remove it; it is
 * a property of interpolating a 90° corner smoothly.
 *
 * Rounding the corners instead gives a smooth path that never overshoots and
 * stays visually distinct from `basis`, which cuts corners far more deeply.
 * The trade is that the path passes *near* each bend rather than exactly
 * through it — documented in docs/diagrams.md.
 */
function naturalPath(points: Point[]): string {
  if (points.length < 3) return linearPath(points)

  /** Largest corner radius, in px. Kept small so edges stay readable. */
  const MAX_RADIUS = 12

  const parts: string[] = [moveTo(points[0]!)]

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!
    const corner = points[i]!
    const next = points[i + 1]!

    const inLen = Math.hypot(corner.x - prev.x, corner.y - prev.y)
    const outLen = Math.hypot(next.x - corner.x, next.y - corner.y)

    // A zero-length leg means duplicated routed points; there is no corner
    // to round, so pass straight through.
    if (inLen === 0 || outLen === 0) {
      parts.push(` L ${corner.x} ${corner.y}`)
      continue
    }

    // Never consume more than half of either adjacent leg, so neighbouring
    // corners cannot overlap and invert the path.
    const radius = Math.min(MAX_RADIUS, inLen / 2, outLen / 2)

    const startX = corner.x - ((corner.x - prev.x) / inLen) * radius
    const startY = corner.y - ((corner.y - prev.y) / inLen) * radius
    const endX = corner.x + ((next.x - corner.x) / outLen) * radius
    const endY = corner.y + ((next.y - corner.y) / outLen) * radius

    // Straight up to the fillet, then a quadratic through the corner.
    parts.push(` L ${startX} ${startY}`)
    parts.push(` Q ${corner.x} ${corner.y}, ${endX} ${endY}`)
  }

  const last = points[points.length - 1]!
  parts.push(` L ${last.x} ${last.y}`)

  return parts.join('')
}

/**
 * Right-angle staircase between consecutive points.
 *
 * `where` picks when the step happens: at the midpoint (`step`), immediately
 * (`stepBefore`), or at the end of the run (`stepAfter`) — matching d3's
 * curveStep family.
 *
 * The final segment is deliberately left straight, running along the original
 * approach direction. An SVG marker with `orient="auto"` takes its angle from
 * the last path segment, so a staircase that ends on a horizontal leg points
 * the arrowhead sideways into the target node instead of at it. Keeping the
 * last leg means the arrow still aims the way the routed edge does.
 */
function stepPath(points: Point[], where: 'mid' | 'before' | 'after'): string {
  const parts: string[] = [moveTo(points[0]!)]
  const lastIndex = points.length - 1

  for (let i = 0; i < lastIndex; i++) {
    const a = points[i]!
    const b = points[i + 1]!

    if (i === lastIndex - 1) {
      parts.push(` L ${b.x} ${b.y}`)
      break
    }

    if (where === 'before') {
      parts.push(` L ${a.x} ${b.y} L ${b.x} ${b.y}`)
    } else if (where === 'after') {
      parts.push(` L ${b.x} ${a.y} L ${b.x} ${b.y}`)
    } else {
      const midY = (a.y + b.y) / 2
      parts.push(` L ${a.x} ${midY} L ${b.x} ${midY} L ${b.x} ${b.y}`)
    }
  }

  return parts.join('')
}

/**
 * Build the `d` attribute for an edge's routed points under `curve`.
 *
 * A path with fewer than two points cannot be drawn; the caller already skips
 * those, but this degrades to an empty string rather than emitting `M`
 * followed by nothing.
 */
export function pointsToPath(
  points: Point[],
  curve: CurveStyle = 'linear',
): string {
  if (points.length === 0) return ''
  if (points.length === 1) return moveTo(points[0]!)

  switch (curve) {
    case 'basis':
      return basisPath(points)
    case 'natural':
      return naturalPath(points)
    case 'step':
      return stepPath(points, 'mid')
    case 'stepBefore':
      return stepPath(points, 'before')
    case 'stepAfter':
      return stepPath(points, 'after')
    case 'linear':
    default:
      return linearPath(points)
  }
}
