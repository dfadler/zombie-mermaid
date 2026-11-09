// ============================================================================
// Radar layout
//
// Mermaid's fixed geometry (diagrams/radar/renderer.ts, mermaid 12.3.0, with
// the default `radar` config): a 600 x 600 chart inside 50px margins, so a
// 700 x 700 viewBox with the centre at (350, 350) and the outer ring at
// radius 300. Axis i points at angle 2*pi*i/n - pi/2 (the first one straight
// up, then clockwise). A value v maps to radius 300 * (v - min) / (max - min),
// clipped to [min, max]; `max` defaults to the largest entry of any curve.
// ============================================================================

import type {
  Radar,
  PositionedRadar,
  PositionedRadarCurve,
} from '@zombie-mermaid/mermaid-parser'

/** Mermaid's default `radar` config. */
export const RADAR = {
  width: 600,
  height: 600,
  marginTop: 50,
  marginRight: 50,
  marginBottom: 50,
  marginLeft: 50,
  axisScaleFactor: 1,
  axisLabelFactor: 1.05,
  curveTension: 0.17,
  /** Pixels between an axis label and the end of its spoke, along the spoke. */
  labelPad: 4,
  legendLineHeight: 20,
} as const

type Point = { x: number; y: number }

// `+ 0` turns -0 into 0.
const r2 = (n: number): number => Math.round(n * 100) / 100 + 0

/** Mermaid's `closedRoundCurve`: a closed cubic bezier through the points. */
function closedRoundCurve(points: Point[], tension: number): string {
  const n = points.length
  const at = (i: number): Point => points[((i % n) + n) % n] as Point
  let d = `M${r2(at(0).x)},${r2(at(0).y)}`
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    const c1 = {
      x: p1.x + (p2.x - p0.x) * tension,
      y: p1.y + (p2.y - p0.y) * tension,
    }
    const c2 = {
      x: p2.x - (p3.x - p1.x) * tension,
      y: p2.y - (p3.y - p1.y) * tension,
    }
    d += ` C${r2(c1.x)},${r2(c1.y)} ${r2(c2.x)},${r2(c2.y)} ${r2(p2.x)},${r2(p2.y)}`
  }
  return `${d} Z`
}

/** Lay a parsed radar out to Mermaid's geometry. */
export function layoutRadar(radar: Radar): PositionedRadar {
  const c = RADAR
  const { axes, curves, options } = radar
  const n = axes.length
  const radius = Math.min(c.width, c.height) / 2
  const angle = (i: number): number => (2 * Math.PI * i) / n - Math.PI / 2
  const max =
    options.max ?? Math.max(...curves.map((cv) => Math.max(...cv.entries)))
  const min = options.min

  const rings = Array.from(
    { length: Math.max(0, Math.ceil(options.ticks)) },
    (_, i) => {
      const r = (radius * (i + 1)) / options.ticks
      return options.graticule === 'circle'
        ? ({ kind: 'circle', r: r2(r) } as const)
        : ({
            kind: 'polygon',
            points: axes.map((_, j) => ({
              x: r2(r * Math.cos(angle(j))),
              y: r2(r * Math.sin(angle(j))),
            })),
          } as const)
    },
  )

  const positionedAxes = axes.map((axis, i) => {
    const cos = Math.cos(angle(i))
    const sin = Math.sin(angle(i))
    return {
      x2: r2(radius * c.axisScaleFactor * cos),
      y2: r2(radius * c.axisScaleFactor * sin),
      label: axis.label,
      labelX: r2(radius * c.axisLabelFactor * cos + c.labelPad * cos),
      labelY: r2(radius * c.axisLabelFactor * sin + c.labelPad * sin),
      anchor: cos > 0.01 ? 'start' : cos < -0.01 ? 'end' : 'middle',
      baseline: sin > 0.01 ? 'hanging' : sin < -0.01 ? 'auto' : 'central',
    } as const
  })

  const positionedCurves: PositionedRadarCurve[] = []
  curves.forEach((curve, index) => {
    // Mermaid skips a curve with the wrong number of values (and still lists it in the legend).
    if (curve.entries.length !== n) return
    const points = curve.entries.map((v, i) => {
      const clipped = Math.min(Math.max(v, min), max)
      const rr = (radius * (clipped - min)) / (max - min)
      return { x: rr * Math.cos(angle(i)), y: rr * Math.sin(angle(i)) }
    })
    positionedCurves.push(
      options.graticule === 'circle'
        ? { index, kind: 'path', d: closedRoundCurve(points, c.curveTension) }
        : {
            index,
            kind: 'polygon',
            points: points.map((p) => ({ x: r2(p.x), y: r2(p.y) })),
          },
    )
  })

  const legendX = ((c.width / 2 + c.marginRight) * 3) / 4
  const legendY = (-(c.height / 2 + c.marginTop) * 3) / 4
  const legend = options.showLegend
    ? curves.map((curve, index) => ({
        index,
        label: curve.label,
        x: legendX,
        y: legendY + index * c.legendLineHeight,
      }))
    : []

  return {
    width: c.width + c.marginLeft + c.marginRight,
    height: c.height + c.marginTop + c.marginBottom,
    centerX: c.marginLeft + c.width / 2,
    centerY: c.marginTop + c.height / 2,
    rings,
    axes: positionedAxes,
    curves: positionedCurves,
    legend,
    title: {
      text: radar.title ?? '',
      x: 0,
      y: -c.height / 2 - c.marginTop,
    },
  }
}
