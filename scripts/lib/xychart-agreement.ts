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

/**
 * How the chart is drawn, which mermaid does not let a diagram change: lines
 * are straight segments (no curve option exists in 12.2.0 or on develop),
 * nothing is a circle (no point markers, no dot grid), and each axis has a
 * line and tick marks. Each flag is one check in `XyAgreement.style`.
 */
export interface XyStyle {
  curved: boolean
  circles: boolean
  axisLine: boolean
  ticks: boolean
}

/** Where an axis line starts and ends along its own direction, in pixels. */
export type XyExtent = [number, number]

export interface XyLayout {
  style: XyStyle
  /**
   * The category and value axis lines. Labels are fractions of their own span
   * everywhere else, which cannot see a plot that reaches past its first and
   * last label (the padding that keeps the smallest bar visible, #2567);
   * these can. Absent when the SVG has no axis line to read.
   */
  axes?: { cat: XyExtent; val: XyExtent }
  /** Labels of the source's `x-axis` (categories or a numeric range). */
  xLabels: XyLabel[]
  /** Labels of the source's `y-axis` (values). */
  yLabels: XyLabel[]
  points: XyPoint[]
  /** Thickness of each bar across the category axis, in pixels; absent without bars. */
  barWidths?: number[]
}

/** Each figure is the share of agreeing items, 0..1, or null with nothing to compare. */
export interface XyAgreement {
  /** Axis labels with the same text at the same index. */
  labels: number | null
  /** Axis labels at the same fraction of their axis. */
  ticks: number | null
  /** Bars and line points at the same category and value fraction. */
  data: number | null
  /** Bars whose thickness is the same share of the category spacing (#2515). */
  bars: number | null
  /** Drawing features (curved lines, circles, axis line, tick marks) that match (#2543). */
  style: number
  /**
   * First and last label on each axis that sit at the same fraction of that
   * axis line, i.e. the same padding or inset. Up to four ends: two on the
   * value axis and two on the category axis. Null without lines.
   */
  extent: number | null
  points: number
}

/** Fraction of an axis; a tick or point further off than this disagrees. */
export const FRACTION_TOLERANCE = 0.01

/**
 * Bar thickness, as a share of the spacing between category labels, may
 * differ by this much: mermaid sizes its label padding from text it measures
 * in a canvas whose plot is wider than ours (about 660 px against 600), so a
 * wide label takes a bigger share of ours. The old fixed 40 px bar was off by
 * 0.2 to 0.3, so this still catches it.
 */
export const BAR_SHARE_TOLERANCE = 0.15

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

const isCurved = (d: string): boolean => /[CQSATcqsat]/.test(d)

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

/**
 * Label text without whitespace: mermaid drops the spaces of an unquoted
 * category (`Week 1` is drawn `Week1`), which we keep on purpose
 * (docs/known-differences.md), so the two are compared without them.
 */
const squash = (text: string): string => text.replace(/\s+/g, '')

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
    /<g\b[^>]*class="([^"]*)"[^>]*>|<text\b([^>]*)>([\s\S]*?)<\/text>|<path\b([^>]*)>/g
  const lines: Record<string, XyExtent> = {}
  for (const m of svg.matchAll(token)) {
    if (m[4] !== undefined) {
      if (axis !== null && sub === 'axis-line') {
        const n = numbers(attr(`<path${m[4]}>`, 'd') ?? '')
        // M x0,y0 L x1,y1: the ends along the axis (y for a vertical one).
        const at = axis === 'left' || axis === 'right' ? [1, 3] : [0, 2]
        lines[axis] = [n[at[0]!]!, n[at[1]!]!]
      }
      continue
    }
    if (m[1] !== undefined) {
      const axisName = /^(bottom|left|top|right)-axis$/.exec(m[1])?.[1]
      if (axisName) {
        axis = axisName
        sub = null
      } else if (/^(label|ticks|title|axis-line|axisl-line)$/.test(m[1])) {
        // Mermaid spells the left axis' line class `axisl-line`.
        sub = m[1] === 'axisl-line' ? 'axis-line' : m[1]
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
  const barWidths: number[] = []
  for (const m of svg.matchAll(
    /<g\b[^>]*class="bar-plot-\d+"[^>]*>([\s\S]*?)<\/g>/g,
  )) {
    for (const r of m[1]!.matchAll(/<rect\b[^>]*>/g)) {
      const [x, y, w, h] = ['x', 'y', 'width', 'height'].map((k) =>
        Number(attr(r[0], k)),
      ) as [number, number, number, number]
      points.push(barPoint({ x0: x, y0: y, x1: x + w, y1: y + h }, horizontal))
      barWidths.push(horizontal ? h : w)
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
  const lineD = [
    ...svg.matchAll(/<g\b[^>]*class="line-plot-\d+"[^>]*>([\s\S]*?)<\/g>/g),
  ]
    .flatMap((m) => [...m[1]!.matchAll(/<path\b[^>]*>/g)])
    .map((p) => attr(p[0], 'd') ?? '')
  return {
    style: {
      curved: lineD.some(isCurved),
      circles: /<circle\b/.test(svg),
      axisLine: /class="(?:axis-line|axisl-line)"/.test(svg),
      ticks: /class="ticks"/.test(svg),
    },
    ...(lines[xName] &&
      lines[yName] && { axes: { cat: lines[xName], val: lines[yName] } }),
    xLabels: bySpot(xLabels),
    yLabels: bySpot(yLabels),
    points,
    ...(barWidths.length > 0 && { barWidths }),
  }
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
  const barWidths: number[] = []
  let frame: { across: XyExtent; down: XyExtent } | undefined
  const style: XyStyle = {
    curved: false,
    circles: /<circle\b/.test(svg),
    axisLine: false,
    ticks: false,
  }
  for (const m of svg.matchAll(/<path\b[^>]*>/g)) {
    const classes = (attr(m[0], 'class') ?? '').split(/\s+/)
    const d = attr(m[0], 'd') ?? ''
    if (classes.includes('xychart-axis')) {
      // The frame is one path (V, H); each tick mark is a plain M, L.
      if (/H/.test(d)) {
        style.axisLine = true
        // M x,y V y1 H x1: the vertical line runs y..y1, the horizontal x..x1.
        const [x, y, y1, x1] = numbers(d) as [number, number, number, number]
        // Horizontal charts run the frame up from the bottom-left corner, so order it.
        frame = { across: [x, x1], down: [Math.min(y, y1), Math.max(y, y1)] }
      } else style.ticks = true
    } else if (classes.includes('xychart-bar')) {
      const box = barBox(d)
      points.push(barPoint(box, horizontal))
      barWidths.push(horizontal ? box.y1 - box.y0 : box.x1 - box.x0)
    } else if (classes.includes('xychart-line')) {
      if (isCurved(d)) style.curved = true
      for (const pt of pathPoints(d)) lines.push(linePoint(pt, horizontal))
    }
  }
  return {
    style,
    ...(frame && {
      axes: horizontal
        ? { cat: frame.down, val: frame.across }
        : { cat: frame.across, val: frame.down },
    }),
    xLabels: bySpot(xLabels),
    yLabels: bySpot(yLabels),
    points: [...points, ...lines],
    ...(barWidths.length > 0 && { barWidths }),
  }
}

/** Positions as fractions of the axis: first label 0, last label 1. */
function fractions(labels: XyLabel[]): (p: number) => number {
  const first = labels[0]?.pos ?? 0
  const span = (labels[labels.length - 1]?.pos ?? 0) - first
  return (p) => (span === 0 ? 0 : (p - first) / span)
}

/** Mean distance between neighbouring labels; null with fewer than two. */
const pitch = (labels: XyLabel[]): number | null =>
  labels.length < 2
    ? null
    : (labels[labels.length - 1]!.pos - labels[0]!.pos) / (labels.length - 1)

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
      if (squash(other.text) === squash(l.text)) sameText++
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
  const ow = official.barWidths ?? []
  const uw = ours.barWidths ?? []
  const po = pitch(official.xLabels)
  const pu = pitch(ours.xLabels)
  const sameBar =
    po && pu
      ? ow.filter(
          (w, i) =>
            uw[i] !== undefined &&
            Math.abs(w / po - uw[i]! / pu) <= BAR_SHARE_TOLERANCE,
        ).length
      : 0
  // Where the first and last label sit along the axis line: a plot that
  // reaches past them shows up here and nowhere else.
  const inset = (labels: XyLabel[], line: XyExtent): number[] =>
    labels.length === 0
      ? []
      : [labels[0]!, labels[labels.length - 1]!].map(
          (l) => (l.pos - line[0]) / (line[1] - line[0]),
        )
  const ends =
    official.axes && ours.axes
      ? // Both axes, each compared with its own counterpart so a chart with
        // no value labels cannot pair category ends with value ends (#2650).
        [
          [official.yLabels, ours.yLabels, 'val'],
          [official.xLabels, ours.xLabels, 'cat'],
        ].flatMap(([ol, ul, axis]) => {
          const o = inset(
            ol as XyLabel[],
            official.axes![axis as 'val' | 'cat'],
          )
          const u = inset(ul as XyLabel[], ours.axes![axis as 'val' | 'cat'])
          return o.map(
            (v, i) => Math.abs(v - (u[i] ?? Infinity)) <= FRACTION_TOLERANCE,
          )
        })
      : []
  return {
    extent: share(ends.filter(Boolean).length, ends.length),
    labels: share(sameText, labelN),
    ticks: share(sameTick, labelN),
    data: share(data, most(official.points, ours.points)),
    bars: po && pu ? share(sameBar, most(ow, uw)) : null,
    style:
      (Object.keys(official.style) as (keyof XyStyle)[]).filter(
        (k) => official.style[k] === ours.style[k],
      ).length / 4,
    points: official.points.length,
  }
}

/**
 * Floor for every sample's lowest figure. Set from the first run against
 * mermaid 12.2.0; a sample that needs a lower one should say why next to it.
 */
export const XYCHART_FLOOR = 1

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
  /** Absent from entries recorded before #2543. */
  style?: number | null
  /** Absent from entries recorded before #2567. */
  extent?: number | null
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
    style: mean(all.map((r) => r.style)),
    extent: mean(all.map((r) => r.extent)),
  }
}

/** Samples under the floor; empty when within it. `errored` samples count as breaches. */
export function xyBreaches(
  results: Record<string, XyAgreement>,
  errored: string[] = [],
): string[] {
  const out = errored.map((t) => `${t} (error)`)
  for (const [title, r] of Object.entries(results)) {
    for (const k of [
      'labels',
      'ticks',
      'data',
      'bars',
      'style',
      'extent',
    ] as const) {
      const v = r[k]
      const floor = XYCHART_FLOOR
      if (v !== null && v + 1e-9 < floor) {
        out.push(`${title} ${k} (${Math.round(v * 100)}% < ${floor * 100}%)`)
      }
    }
  }
  return out
}
