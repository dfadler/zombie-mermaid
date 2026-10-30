/**
 * Quadrant-chart figure agreement against official mermaid.js (#2437), for
 * scripts/quadrant-oracle.ts. Browser-free so it can be unit-tested.
 *
 * Quadrant geometry measures no text (quadrantBuilder.ts is pure arithmetic),
 * so rect, line, circle and text positions must match exactly; the tolerance
 * only absorbs mermaid printing floats like 214.60000000000002. Colours are
 * not compared: they are a documented difference (docs/known-differences.md).
 */
import { parseQuadrantChart } from '@zombie-mermaid/mermaid-parser'
import { layoutQuadrantChart } from '../../packages/svg-renderer/src/quadrant/layout.ts'

export interface QuadText {
  text: string
  x: number
  y: number
  fontSize: number
  anchor: string
  baseline: string
  rotation: number
}

export interface QuadFigure {
  rects: [number, number, number, number][]
  lines: [number, number, number, number, number][]
  circles: [number, number, number][]
  texts: QuadText[]
}

const attr = (tag: string, name: string): string | undefined =>
  new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag)?.[1]

const num = (tag: string, name: string): number => Number(attr(tag, name))

/** Official mermaid: DOM order is quadrants, border lines, points, axis labels, title. */
export function parseOfficialQuadrant(svg: string): QuadFigure {
  const fig: QuadFigure = { rects: [], lines: [], circles: [], texts: [] }
  for (const [tag] of svg.matchAll(/<(?:rect|line|circle|text)\b[^>]*>/g)) {
    if (tag.startsWith('<rect')) {
      fig.rects.push([
        num(tag, 'x'),
        num(tag, 'y'),
        num(tag, 'width'),
        num(tag, 'height'),
      ])
    } else if (tag.startsWith('<line')) {
      const sw = /stroke-width:\s*([\d.]+)/.exec(attr(tag, 'style') ?? '')?.[1]
      fig.lines.push([
        num(tag, 'x1'),
        num(tag, 'y1'),
        num(tag, 'x2'),
        num(tag, 'y2'),
        Number(sw),
      ])
    } else if (tag.startsWith('<circle')) {
      fig.circles.push([num(tag, 'cx'), num(tag, 'cy'), num(tag, 'r')])
    }
  }
  for (const m of svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)) {
    const t = /translate\(([-\d.]+),\s*([-\d.]+)\)\s*rotate\(([-\d.]+)\)/.exec(
      attr(m[1]!, 'transform') ?? '',
    )
    fig.texts.push({
      text: m[2]!,
      x: Number(t?.[1]),
      y: Number(t?.[2]),
      fontSize: num(m[1]!, 'font-size'),
      anchor: attr(m[1]!, 'text-anchor') ?? '',
      baseline: attr(m[1]!, 'dominant-baseline') ?? '',
      rotation: Number(t?.[3]),
    })
  }
  return fig
}

/**
 * Our layout, flattened the same way. Mermaid draws an empty `<text>` for a
 * label-less quadrant and we draw nothing (a documented difference), so empty
 * texts are dropped from both sides.
 */
export function ourQuadrant(source: string): QuadFigure {
  const l = layoutQuadrantChart(parseQuadrantChart(source))
  const texts = [
    ...l.quadrants.map((q) => q.text),
    ...l.axisLabels,
    ...(l.title ? [l.title] : []),
    ...l.points.map((p) => p.text),
  ]
  return {
    rects: l.quadrants.map((q) => [q.x, q.y, q.width, q.height]),
    lines: l.lines.map((x) => [x.x1, x.y1, x.x2, x.y2, x.strokeWidth]),
    circles: l.points.map((p) => [p.x, p.y, p.radius]),
    texts: texts.map((t) => ({
      text: t.text,
      x: t.x,
      y: t.y,
      fontSize: t.fontSize,
      anchor: t.anchor,
      baseline: t.baseline,
      rotation: t.rotation,
    })),
  }
}

/** Official figures with empty texts removed and texts in a canonical order. */
export function normalizeQuadrant(f: QuadFigure): QuadFigure {
  const key = (t: QuadText) => `${t.text}\0${t.rotation}\0${t.x}\0${t.y}`
  return {
    ...f,
    texts: f.texts
      .filter((t) => t.text !== '')
      .sort((a, b) => (key(a) < key(b) ? -1 : 1)),
  }
}

/** Tolerance for mermaid's float printing; the geometry itself has none. */
export const QUADRANT_TOLERANCE = 1e-6

/** Every mismatch between the two figures, empty when they agree. */
export function quadrantMismatches(
  official: QuadFigure,
  ours: QuadFigure,
  tol: number = QUADRANT_TOLERANCE,
): string[] {
  const o = normalizeQuadrant(official)
  const u = normalizeQuadrant(ours)
  const out: string[] = []
  const close = (a: number[], b: number[]) =>
    a.length === b.length && a.every((v, i) => Math.abs(v - b[i]!) <= tol)
  for (const kind of ['rects', 'lines', 'circles'] as const) {
    const a = o[kind] as number[][]
    const b = u[kind] as number[][]
    if (a.length !== b.length)
      out.push(`${kind}: ${a.length} official, ${b.length} ours`)
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (!close(a[i]!, b[i]!))
        out.push(`${kind}[${i}]: [${a[i]}] official, [${b[i]}] ours`)
    }
  }
  if (o.texts.length !== u.texts.length) {
    out.push(`texts: ${o.texts.length} official, ${u.texts.length} ours`)
  }
  for (let i = 0; i < Math.min(o.texts.length, u.texts.length); i++) {
    const a = o.texts[i]!
    const b = u.texts[i]!
    const same =
      a.text === b.text &&
      a.fontSize === b.fontSize &&
      a.anchor === b.anchor &&
      a.baseline === b.baseline &&
      close([a.x, a.y, a.rotation], [b.x, b.y, b.rotation])
    if (!same)
      out.push(
        `text "${a.text}": ${JSON.stringify(a)} official, ${JSON.stringify(b)} ours`,
      )
  }
  return out
}
