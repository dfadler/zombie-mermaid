/**
 * Straighten sub-pixel jogs in orthogonal edge routes.
 *
 * ELK spreads parallel edges across each node's side relative to that node's
 * own width, so two edges between differently sized, centered nodes leave and
 * arrive at slightly different offsets. The route then runs straight, steps
 * sideways by a fraction of a pixel, and runs straight again — a visible kink
 * that also tilts the arrowhead off the edge's axis (#1388).
 */

import type { Point } from '@zombie-mermaid/core'

/** Largest sideways step, in px, treated as an artifact rather than a bend. */
const MAX_JOG = 1.5

/** Slack for deciding two coordinates are "the same" run. */
const EPS = 0.01

/**
 * Collapse `run, tiny step, run` into one straight run along the shared axis.
 * Pattern (vertical form): A-B vertical, B-C horizontal with |dx| <= MAX_JOG,
 * C-D vertical. Returns a new array; the input is not mutated.
 */
export function straightenTinyJogs(points: Point[]): Point[] {
  const out = points.map((p) => ({ ...p }))
  let i = 0
  while (i + 3 < out.length) {
    const [a, b, c, d] = [out[i]!, out[i + 1]!, out[i + 2]!, out[i + 3]!]
    const vertical =
      Math.abs(a.x - b.x) < EPS &&
      Math.abs(c.x - d.x) < EPS &&
      Math.abs(b.y - c.y) < EPS &&
      Math.abs(b.x - c.x) <= MAX_JOG &&
      Math.abs(b.x - c.x) >= EPS
    const horizontal =
      Math.abs(a.y - b.y) < EPS &&
      Math.abs(c.y - d.y) < EPS &&
      Math.abs(b.x - c.x) < EPS &&
      Math.abs(b.y - c.y) <= MAX_JOG &&
      Math.abs(b.y - c.y) >= EPS
    if (vertical) {
      const x = (a.x + d.x) / 2
      out.splice(i, 4, { x, y: a.y }, { x, y: d.y })
    } else if (horizontal) {
      const y = (a.y + d.y) / 2
      out.splice(i, 4, { x: a.x, y }, { x: d.x, y })
    } else {
      i++
    }
  }
  return out
}
