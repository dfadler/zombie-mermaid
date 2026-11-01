/**
 * XY-chart agreement against official mermaid.js (#2451, #1686), for
 * scripts/xychart-oracle.ts. Browser-free so it can be unit-tested.
 *
 * An xychart has no node layout, so what can regress is the scale: which
 * labels sit on each axis, where the ticks fall along it, and where each bar
 * end and line point lands. The two renderers use different canvas sizes, so
 * every position is taken as a fraction of its axis (first label = 0, last
 * label = 1) instead of in pixels. Bars and line points are matched by
 * position in the drawing (bars first, then lines, each in source order).
 */

/** One axis label: its text and where it sits along the axis, in pixels. */
export interface XyLabel {
  text: string
  pos: number
}

/** One bar end or line point: coordinate along the category and the value axis, in pixels. */
export interface XyPoint {
  cat: number
  val: number
}

export interface XyLayout {
  /** Labels of the source's `x-axis` (categories or a numeric range). */
  xLabels: XyLabel[]
  /** Labels of the source's `y-axis` (values). */
  yLabels: XyLabel[]
  points: XyPoint[]
}

/** Each figure is the share of agreeing items, 0..1, or null with nothing to compare. */
export interface XyAgreement {
  /** Axis labels with the same text at the same index. */
  labels: number | null
  /** Axis labels at the same fraction of their axis. */
  ticks: number | null
  /** Bars and line points at the same category and value fraction. */
  data: number | null
  points: number
}

/** Fraction of an axis; a tick or point further off than this disagrees. */
export const FRACTION_TOLERANCE = 0.01

/** Text content of `html`: tags removed until none are left (so `<scr<b>ipt>` cannot reassemble), then entities decoded. */
export function strip(html: string): string {
  let prev: string
  let out = html
  do {
    prev = out
    out = out.replace(/<[^>]*>/g, '')
  } while (out !== prev)
  return out
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

/** Whether the source asks for `xychart-beta horizontal`. */
export const isHorizontal = (source: string): boolean =>
  /^\s*xychart(?:-beta)?\s+horizontal\b/.test(source)

const attr = (tag: string, name: string): string | undefined => {
  const start = tag.indexOf(` ${name}="`)
  if (start < 0) return undefined
  const from = start + name.length + 3
  return tag.slice(from, tag.indexOf('"', from))
}

const pairs = (nums: number[]): [number, number][] => {
  const out: [number, number][] = []
  for (let i = 0; i + 1 < nums.length; i += 2)
    out.push([nums[i]!, nums[i + 1]!])
  return out
}

const numbers = (s: string): number[] =>
  (s.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g) ?? []).map(Number)

/** End point of every M/L/C command of a line path: the drawn data points. */
export function pathPoints(d: string): [number, number][] {
  const out: [number, number][] = []
  for (const m of d.matchAll(/([MLC])([^MLC]*)/g)) {
    const last = pairs(numbers(m[2]!)).pop()
    if (last) out.push(last)
  }
  return out
}

/** Bounding box of a bar path made of M/L/Q/h/v/Z commands. */
export function barBox(d: string): {
  x0: number
  y0: number
  x1: number
  y1: number
} {
  let x = 0
  let y = 0
  const xs: number[] = []
  const ys: number[] = []
  const at = (px: number, py: number): void => {
    x = px
    y = py
    xs.push(px)
    ys.push(py)
  }
  for (const m of d.matchAll(/([MLQhvZ])([^MLQhvZ]*)/g)) {
    const n = numbers(m[2]!)
    if (m[1] === 'h') at(x + n[0]!, y)
    else if (m[1] === 'v') at(x, y + n[0]!)
    else for (const [px, py] of pairs(n)) at(px, py)
  }
  return {
    x0: Math.min(...xs),
    y0: Math.min(...ys),
    x1: Math.max(...xs),
    y1: Math.max(...ys),
  }
}

/** Bar end (where the value is) and centre across the category axis. */
const barPoint = (
  b: ReturnType<typeof barBox>,
  horizontal: boolean,
): XyPoint =>
  horizontal
    ? { cat: (b.y0 + b.y1) / 2, val: b.x1 }
    : { cat: (b.x0 + b.x1) / 2, val: b.y0 }

const linePoint = (p: [number, number], horizontal: boolean): XyPoint =>
  horizontal ? { cat: p[1], val: p[0] } : { cat: p[0], val: p[1] }

/** Labels in drawing order along the axis (the renderers emit them in different orders). */
const bySpot = (labels: XyLabel[]): XyLabel[] =>
  [...labels].sort((a, b) => a.pos - b.pos)

/**
 * Official mermaid: tick labels are `g.label` texts inside `g.bottom-axis`,
 * `left-axis`, `top-axis` or `right-axis` (the category axis sits at the
 * bottom, or at the left when horizontal); bars are `rect`s in `g.bar-plot-N`
 * and lines `path`s in `g.line-plot-N`.
 */
export function parseOfficialXy(svg: string, horizontal: boolean): XyLayout {
  const xName = horizontal ? 'left' : 'bottom'
  const yName = horizontal ? 'top' : 'left'
  const xLabels: XyLabel[] = []
  const yLabels: XyLabel[] = []
  let axis: string | null = null
  let sub: string | null = null
  const token =
    /<g\b[^>]*class="([^"]*)"[^>]*>|<text\b([^>]*)>([\s\S]*?)<\/text>/g
  for (const m of svg.matchAll(token)) {
    if (m[1] !== undefined) {
      const axisName = /^(bottom|left|top|right)-axis$/.exec(m[1])?.[1]
      if (axisName) {
        axis = axisName
        sub = null
      } else if (/^(label|ticks|title|axis-line|axisl-line)$/.test(m[1])) {
        sub = m[1]
      } else {
        axis = null
      }
      continue
    }
    if (axis === null || sub !== 'label') continue
    const t = /translate\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/.exec(m[2]!)
    if (!t) continue
    const label = {
      text: strip(m[3]!),
      pos: Number(axis === 'left' || axis === 'right' ? t[2] : t[1]),
    }
    if (axis === xName) xLabels.push(label)
    else if (axis === yName) yLabels.push(label)
  }
  const points: XyPoint[] = []
  for (const m of svg.matchAll(
    /<g\b[^>]*class="bar-plot-\d+"[^>]*>([\s\S]*?)<\/g>/g,
  )) {
    for (const r of m[1]!.matchAll(/<rect\b[^>]*>/g)) {
      const [x, y, w, h] = ['x', 'y', 'width', 'height'].map((k) =>
        Number(attr(r[0], k)),
      ) as [number, number, number, number]
      points.push(barPoint({ x0: x, y0: y, x1: x + w, y1: y + h }, horizontal))
    }
  }
  for (const m of svg.matchAll(
    /<g\b[^>]*class="line-plot-\d+"[^>]*>([\s\S]*?)<\/g>/g,
  )) {
    for (const p of m[1]!.matchAll(/<path\b[^>]*>/g)) {
      for (const pt of pathPoints(attr(p[0], 'd') ?? '')) {
        points.push(linePoint(pt, horizontal))
      }
    }
  }
  return { xLabels: bySpot(xLabels), yLabels: bySpot(yLabels), points }
}

/**
 * Our renderer: tick labels are `text.xychart-label` (centred under the
 * category axis, right-aligned beside the value axis, or the reverse when
 * horizontal; the legend's start-aligned ones are skipped), bars are
 * `path.xychart-bar` and lines `path.xychart-line`.
 */
export function parseOurXy(svg: string, horizontal: boolean): XyLayout {
  const xLabels: XyLabel[] = []
  const yLabels: XyLabel[] = []
  for (const m of svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const tag = `<text${m[1]}>`
    if (!/\bxychart-label\b/.test(attr(tag, 'class') ?? '')) continue
    const anchor = attr(tag, 'text-anchor')
    if (anchor === 'start') continue
    const column = anchor === 'end'
    const label = {
      text: strip(m[2]!),
      pos: Number(attr(tag, column ? 'y' : 'x')),
    }
    // Vertical: categories run along the bottom (middle), values up the left (end).
    if (column === horizontal) xLabels.push(label)
    else yLabels.push(label)
  }
  const points: XyPoint[] = []
  const lines: XyPoint[] = []
  for (const m of svg.matchAll(/<path\b[^>]*>/g)) {
    const classes = (attr(m[0], 'class') ?? '').split(/\s+/)
    const d = attr(m[0], 'd') ?? ''
    if (classes.includes('xychart-bar')) {
      points.push(barPoint(barBox(d), horizontal))
    } else if (classes.includes('xychart-line')) {
      for (const pt of pathPoints(d)) lines.push(linePoint(pt, horizontal))
    }
  }
  return {
    xLabels: bySpot(xLabels),
    yLabels: bySpot(yLabels),
    points: [...points, ...lines],
  }
}

/** Positions as fractions of the axis: first label 0, last label 1. */
function fractions(labels: XyLabel[]): (p: number) => number {
  const first = labels[0]?.pos ?? 0
  const span = (labels[labels.length - 1]?.pos ?? 0) - first
  return (p) => (span === 0 ? 0 : (p - first) / span)
}

const share = (agree: number, total: number): number | null =>
  total === 0 ? null : agree / total

/** Label, tick and data-point agreement of our chart with the official one. */
export function xyAgreement(official: XyLayout, ours: XyLayout): XyAgreement {
  // Surplus or missing items count as disagreements.
  const most = (a: unknown[], b: unknown[]): number =>
    Math.max(a.length, b.length)
  const axes: [XyLabel[], XyLabel[]][] = [
    [official.xLabels, ours.xLabels],
    [official.yLabels, ours.yLabels],
  ]
  let sameText = 0
  let sameTick = 0
  let labelN = 0
  for (const [o, u] of axes) {
    const fo = fractions(o)
    const fu = fractions(u)
    labelN += most(o, u)
    o.forEach((l, i) => {
      const other = u[i]
      if (other === undefined) return
      if (other.text === l.text) sameText++
      if (Math.abs(fo(l.pos) - fu(other.pos)) <= FRACTION_TOLERANCE) sameTick++
    })
  }
  const cat = [fractions(official.xLabels), fractions(ours.xLabels)] as const
  const val = [fractions(official.yLabels), fractions(ours.yLabels)] as const
  const data = official.points.filter((p, i) => {
    const q = ours.points[i]
    return (
      q !== undefined &&
      Math.abs(cat[0](p.cat) - cat[1](q.cat)) <= FRACTION_TOLERANCE &&
      Math.abs(val[0](p.val) - val[1](q.val)) <= FRACTION_TOLERANCE
    )
  }).length
  return {
    labels: share(sameText, labelN),
    ticks: share(sameTick, labelN),
    data: share(data, most(official.points, ours.points)),
    points: official.points.length,
  }
}

/**
 * Floor for every sample's lowest figure. Set from the first run against
 * mermaid 12.2.0; a sample that needs a lower one should say why next to it.
 */
export const XYCHART_FLOOR = 1

/**
 * Lower floor for a sample's `data` figure. Mermaid 12.2.0 draws every bar
 * series centred on the same x (the series overlap); we offset them side by
 * side, so no bar of a second series lines up. A known gap, recorded here so
 * the other figures of that sample stay guarded rather than the sample being
 * dropped; remove the entry when the renderer matches.
 */
export const DATA_FLOOR: Readonly<Record<string, number>> = {
  'XY: Multiple Bar Series': 0,
}

/** One tracked xychart data point: mean of each figure over the xychart samples. */
export interface XyEntry {
  kind: 'xychart'
  date: string
  commit: string
  mermaid: string
  samples: number
  labels: number | null
  ticks: number | null
  data: number | null
}

const mean = (xs: (number | null)[]): number | null => {
  const v = xs.filter((n): n is number => n !== null)
  return v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : null
}

/** Collapse per-sample results into one history entry. */
export function summarizeXy(
  results: Record<string, XyAgreement>,
  meta: { date: string; commit: string; mermaid: string },
): XyEntry {
  const all = Object.values(results)
  return {
    kind: 'xychart',
    ...meta,
    samples: all.length,
    labels: mean(all.map((r) => r.labels)),
    ticks: mean(all.map((r) => r.ticks)),
    data: mean(all.map((r) => r.data)),
  }
}

/** Samples under the floor; empty when within it. `errored` samples count as breaches. */
export function xyBreaches(
  results: Record<string, XyAgreement>,
  errored: string[] = [],
): string[] {
  const out = errored.map((t) => `${t} (error)`)
  for (const [title, r] of Object.entries(results)) {
    for (const k of ['labels', 'ticks', 'data'] as const) {
      const v = r[k]
      const floor =
        k === 'data' ? (DATA_FLOOR[title] ?? XYCHART_FLOOR) : XYCHART_FLOOR
      if (v !== null && v + 1e-9 < floor) {
        out.push(`${title} ${k} (${Math.round(v * 100)}% < ${floor * 100}%)`)
      }
    }
  }
  return out
}
