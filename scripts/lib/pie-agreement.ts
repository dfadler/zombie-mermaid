/**
 * Pie-chart agreement against official mermaid.js (#2451, #1686), for
 * scripts/pie-oracle.ts. Browser-free so it can be unit-tested.
 *
 * A pie has no node layout, so what can regress is the angles: where each
 * drawn slice starts and how far it sweeps (clockwise from 12 o'clock), the
 * percentage printed on it, and the legend rows. Slices are matched by
 * position in the drawing, so a different slice order shows up as an angle
 * disagreement. Radius, centre and fonts are not compared.
 */

/** One drawn slice: start and sweep in degrees, clockwise from 12 o'clock. */
export interface PieSlice {
  start: number
  sweep: number
}

export interface PieLayout {
  slices: PieSlice[]
  /** Text printed on each slice (`60%`), in drawing order. */
  labels: string[]
  /** Legend row texts (`Chrome [60]`), in order. */
  legend: string[]
}

/** Each figure is the share of agreeing items, 0..1, or null with nothing to compare. */
export interface PieAgreement {
  /** Slices whose start and sweep are both within ANGLE_TOLERANCE degrees. */
  angles: number | null
  /** Slices printing the same percentage text. */
  labels: number | null
  /** Legend rows with the same text at the same position. */
  legend: number | null
  slices: number
}

/** Degrees; mermaid rounds path coordinates to three decimals, so this is generous. */
export const ANGLE_TOLERANCE = 0.5

const nums = (s: string): number[] =>
  (s.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)

const unescape = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

/** Text content of `html`: tags removed until none are left (so `<scr<b>ipt>` cannot reassemble), then entities decoded. */
export function strip(html: string): string {
  let prev: string
  let out = html
  do {
    prev = out
    out = out.replace(/<[^>]*>/g, '')
  } while (out !== prev)
  return unescape(out)
}

/**
 * Start and sweep of a slice path `M x1,y1 A r,r,0,large,1,x2,y2 L cx,cy Z`.
 * A whole circle (two arcs, no wedge) sweeps 360.
 */
export function sliceFromPath(d: string): PieSlice | undefined {
  const n = nums(d)
  if ((d.match(/A/g) ?? []).length >= 2) return { start: 0, sweep: 360 }
  if (n.length < 11) return undefined
  const [x1, y1, , , , , , x2, y2] = n as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ]
  const cx = n[n.length - 2]!
  const cy = n[n.length - 1]!
  const angle = (x: number, y: number): number =>
    (((Math.atan2(x - cx, cy - y) * 180) / Math.PI) % 360) + 360
  const start = angle(x1, y1) % 360
  const sweep = (angle(x2, y2) - angle(x1, y1) + 360) % 360
  return { start, sweep: sweep === 0 ? 360 : sweep }
}

function collect(
  svg: string,
  pathClass: RegExp,
  label: RegExp,
  legend: RegExp,
) {
  const slices: PieSlice[] = []
  for (const m of svg.matchAll(/<path\b[^>]*>/g)) {
    if (!pathClass.test(m[0])) continue
    const d = /\sd="([^"]*)"/.exec(m[0])?.[1]
    const slice = d === undefined ? undefined : sliceFromPath(d)
    if (slice) slices.push(slice)
  }
  const texts = (re: RegExp): string[] =>
    [...svg.matchAll(re)].map((m) => strip(m[1]!).trim())
  return { slices, labels: texts(label), legend: texts(legend) }
}

/** Official mermaid: `path.pieCircle`, `text.slice`, and the `text` in each `g.legend`. */
export function parseOfficialPie(svg: string): PieLayout {
  return collect(
    svg,
    /class="pieCircle"/,
    /<text\b[^>]*class="slice"[^>]*>([\s\S]*?)<\/text>/g,
    /<g\b[^>]*class="legend"[^>]*>[\s\S]*?<text\b[^>]*>([\s\S]*?)<\/text>/g,
  )
}

/** Our renderer: `path.pie-slice`, `text.pie-slice-label`, `text.pie-legend-text`. */
export function parseOurPie(svg: string): PieLayout {
  return collect(
    svg,
    /class="pie-slice\b[^"]*"/,
    /<text\b[^>]*class="pie-slice-label"[^>]*>([\s\S]*?)<\/text>/g,
    /<text\b[^>]*class="pie-legend-text"[^>]*>([\s\S]*?)<\/text>/g,
  )
}

const share = (agree: number, total: number): number | null =>
  total === 0 ? null : agree / total

/** Circular distance in degrees between two angles. */
const gap = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360
  return Math.min(d, 360 - d)
}

/** Angle, label and legend agreement of our pie with the official one. */
export function pieAgreement(
  official: PieLayout,
  ours: PieLayout,
): PieAgreement {
  // Surplus or missing items count as disagreements.
  const count = (a: unknown[], b: unknown[]): number =>
    Math.max(a.length, b.length)
  const sliceN = count(official.slices, ours.slices)
  const angles = official.slices.filter((o, i) => {
    const s = ours.slices[i]
    return (
      s !== undefined &&
      gap(o.start, s.start) <= ANGLE_TOLERANCE &&
      Math.abs(o.sweep - s.sweep) <= ANGLE_TOLERANCE
    )
  }).length
  const same = (a: string[], b: string[]): number =>
    a.filter((t, i) => t === b[i]).length
  return {
    angles: share(angles, sliceN),
    labels: share(
      same(official.labels, ours.labels),
      count(official.labels, ours.labels),
    ),
    legend: share(
      same(official.legend, ours.legend),
      count(official.legend, ours.legend),
    ),
    slices: official.slices.length,
  }
}

/** Lowest figure of a sample, or null when it has none. */
export function worstPie(a: PieAgreement): number | null {
  const v = [a.angles, a.labels, a.legend].filter(
    (n): n is number => n !== null,
  )
  return v.length > 0 ? Math.min(...v) : null
}

/**
 * Floor for every sample's lowest figure. Set from the first run against
 * mermaid 12.2.0; a sample that needs a lower one should say why next to it.
 */
export const PIE_FLOOR = 1

/** One tracked pie data point: mean of each figure over the pie samples. */
export interface PieEntry {
  kind: 'pie'
  date: string
  commit: string
  mermaid: string
  samples: number
  angles: number | null
  labels: number | null
  legend: number | null
}

const mean = (xs: (number | null)[]): number | null => {
  const v = xs.filter((n): n is number => n !== null)
  return v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : null
}

/** Collapse per-sample results into one history entry. */
export function summarizePie(
  results: Record<string, PieAgreement>,
  meta: { date: string; commit: string; mermaid: string },
): PieEntry {
  const all = Object.values(results)
  return {
    kind: 'pie',
    ...meta,
    samples: all.length,
    angles: mean(all.map((r) => r.angles)),
    labels: mean(all.map((r) => r.labels)),
    legend: mean(all.map((r) => r.legend)),
  }
}

/** Samples under the floor; empty when within it. `errored` samples count as breaches. */
export function pieBreaches(
  results: Record<string, PieAgreement>,
  errored: string[] = [],
): string[] {
  const out = errored.map((t) => `${t} (error)`)
  for (const [title, r] of Object.entries(results)) {
    const low = worstPie(r)
    if (low !== null && low + 1e-9 < PIE_FLOOR) {
      out.push(`${title} (${Math.round(low * 100)}% < ${PIE_FLOOR * 100}%)`)
    }
  }
  return out
}
