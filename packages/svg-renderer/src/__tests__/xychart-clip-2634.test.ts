import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'

// `bar [10, 80, 30]` on a 0..50 axis: the middle bar overshoots the plot area.
const src = (head: string) =>
  `${head}\n    x-axis [a, b, c]\n    y-axis "v" 0 --> 50\n    bar [10, 80, 30]\n    line [5, 60, 20]`

const nums = (d: string) =>
  [...d.matchAll(/-?[\d.]+/g)].map((m) => Number(m[0]))

/**
 * Plot area from the axis path: `M<x>,<top> V<bottom> H<right>` (value axis at
 * the bottom), or `M<x>,<bottom> V<top> H<right>` for a horizontal chart
 * (value axis along the top).
 */
function plot(svg: string) {
  const [x, y0, y1, right] = nums(
    svg.match(/<path d="(M[^"]*)" class="xychart-axis"/)![1]!,
  ) as [number, number, number, number]
  return { x, top: Math.min(y0, y1), bottom: Math.max(y0, y1), right }
}

describe.each(['xychart-beta', 'xychart-beta horizontal'])(
  'bars clip to the plot area (#2634, %s)',
  (head) => {
    const svg = renderMermaidSVG(src(head), { interactive: true })
    const p = plot(svg)
    const eps = 0.11 // Path coordinates are rounded to 0.1.

    it('keeps every bar path inside the plot', () => {
      const bars = [...svg.matchAll(/<path d="([^"]*)" class="xychart-bar /g)]
      expect(bars).toHaveLength(3)
      for (const [, d] of bars) {
        const n = nums(d!)
        const xs = [n[0]!, n[2]!]
        const ys = [n[1]!, n[3]!]
        expect(Math.min(...xs)).toBeGreaterThanOrEqual(p.x - eps)
        expect(Math.max(...xs)).toBeLessThanOrEqual(p.right + eps)
        expect(Math.min(...ys)).toBeGreaterThanOrEqual(p.top - eps)
        expect(Math.max(...ys)).toBeLessThanOrEqual(p.bottom + eps)
      }
    })

    it('keeps hit areas and tooltips inside the plot too', () => {
      const groups = [
        ...svg.matchAll(/<g class="xychart-bar-group">(.*?)<\/g>/g),
      ]
      expect(groups).toHaveLength(3)
      for (const [, g] of groups) {
        const [x, y, w, h] = [
          ...g!.matchAll(
            /<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)" fill="transparent"/g,
          ),
        ][0]!
          .slice(1)
          .map(Number) as [number, number, number, number]
        expect(x).toBeGreaterThanOrEqual(p.x - eps)
        expect(x + w).toBeLessThanOrEqual(p.right + eps)
        expect(y).toBeGreaterThanOrEqual(p.top - eps)
        expect(y + h).toBeLessThanOrEqual(p.bottom + eps)
      }
      // The overshooting bar's tooltip must not sit above the canvas.
      const ys = [...svg.matchAll(/<text [^>]*\by="(-?[\d.]+)"/g)].map((m) =>
        Number(m[1]),
      )
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(0)
    })
  },
)
