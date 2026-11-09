/**
 * Requirement diagram agreement against official mermaid.js, for
 * scripts/requirement-oracle.ts. Browser-free so it can be unit-tested.
 *
 * What is compared, per sample, as the share of agreeing items (0..1):
 *   - boxes: same id, the same rows of text, and the same width and height
 *     (Mermaid sizes a box from its text, so this is the text measurement)
 *   - edges: same relationship order, label, dashed or solid, and which box
 *     the line starts at and ends at
 *   - positions: boxes within TOLERANCE px of Mermaid's (dagre there, ELK
 *     here, so this is the layout, and is scored apart from the sizes)
 *   - frame: the drawing's width and height within SIZE_TOLERANCE px
 * Colours, fonts and the exact line routes are not compared.
 */

export interface RequirementBox {
  id: string
  /** Centre, relative to the viewBox origin. */
  cx: number
  cy: number
  width: number
  height: number
  /** Every row of text in the box, in order, `<<` and `>>` unescaped. */
  rows: string[]
}

export interface RequirementLine {
  /** `satisfies`, from the `<<satisfies>>` label. */
  type: string
  dashed: boolean
  /** Ids of the boxes at the first and last point. */
  from?: string
  to?: string
}

export interface RequirementLayout {
  boxes: RequirementBox[]
  edges: RequirementLine[]
  size?: { width: number; height: number }
}

export interface RequirementAgreement {
  boxes: number | null
  edges: number | null
  positions: number | null
  frame: number | null
  nodes: number
}

/** Pixels; Mermaid prints float sums to many digits. */
export const TOLERANCE = 0.5
/** Pixels for the drawing size, which sums box and gap widths. */
export const SIZE_TOLERANCE = 3

const unescape = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

const num = (s: string | undefined): number => Number(s)

/** The box whose border `p` lies on (within 1.5px), else the nearest box. */
function boxAt(
  boxes: RequirementBox[],
  p: { x: number; y: number },
): string | undefined {
  let best: string | undefined
  let bestDist = Infinity
  for (const b of boxes) {
    const dx = Math.max(Math.abs(p.x - b.cx) - b.width / 2, 0)
    const dy = Math.max(Math.abs(p.y - b.cy) - b.height / 2, 0)
    const d = Math.hypot(dx, dy)
    if (d < bestDist) {
      bestDist = d
      best = b.id
    }
  }
  return best
}

/** Read the viewBox: origin and size. */
function viewBox(svg: string): number[] {
  return (
    /viewBox="([^"]*)"/.exec(svg)?.[1]?.split(/\s+/).map(Number) ?? [0, 0, 0, 0]
  )
}

/** Read the boxes, relationships and size from official mermaid.js markup. */
export function parseOfficialRequirementSvg(svg: string): RequirementLayout {
  const [ox = 0, oy = 0, width = 0, height = 0] = viewBox(svg)
  const boxes: RequirementBox[] = []
  const starts = [
    ...svg.matchAll(
      /<g class="node default[^"]*"[^>]*? id="[^"-]*-([^"]*)"[^>]*transform="translate\(([-\d.e]+), ([-\d.e]+)\)">/g,
    ),
  ]
  for (const [i, m] of starts.entries()) {
    const body = svg.slice(m.index, starts[i + 1]?.index ?? svg.length)
    const path = /<path d="M([-\d.e]+) ([-\d.e]+) L/.exec(body)
    boxes.push({
      id: m[1]!,
      cx: num(m[2]) - ox,
      cy: num(m[3]) - oy,
      width: -num(path?.[1]) * 2,
      height: -num(path?.[2]) * 2,
      rows: [...body.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((p) =>
        unescape(p[1]!),
      ),
    })
  }
  const edges: RequirementLine[] = []
  const paths = [
    ...svg.matchAll(
      /<path d="[^"]*" id="[^"]*" class="([^"]*)"[^>]*?data-points="([^"]*)"/g,
    ),
  ]
  const labels = [
    ...svg.matchAll(/<g class="edgeLabel"[\s\S]*?<p>([\s\S]*?)<\/p>/g),
  ]
  for (const [i, m] of paths.entries()) {
    const pts = JSON.parse(atob(m[2]!)) as { x: number; y: number }[]
    const first = pts[0]!
    const last = pts[pts.length - 1]!
    // data-points are in the same space as the node translates.
    const rel = (p: { x: number; y: number }) => ({
      x: p.x - ox,
      y: p.y - oy,
    })
    edges.push({
      type: unescape(labels[i]?.[1] ?? '').replace(/^<<|>>$/g, ''),
      dashed: /edge-pattern-dashed/.test(m[1]!),
      from: boxAt(boxes, rel(first)),
      to: boxAt(boxes, rel(last)),
    })
  }
  return { boxes, edges, size: { width, height } }
}

/** Read the boxes, relationships and size from our markup. */
export function parseOurRequirementSvg(svg: string): RequirementLayout {
  const [, , width = 0, height = 0] = viewBox(svg)
  const boxes: RequirementBox[] = []
  for (const m of svg.matchAll(
    /<g class="requirement-node[^"]*" data-id="([^"]*)"[^>]*>([\s\S]*?)<\/g>/g,
  )) {
    const rect =
      /<rect x="([-\d.e]+)" y="([-\d.e]+)" width="([-\d.e]+)" height="([-\d.e]+)"/.exec(
        m[2]!,
      )
    boxes.push({
      id: unescape(m[1]!),
      cx: num(rect?.[1]) + num(rect?.[3]) / 2,
      cy: num(rect?.[2]) + num(rect?.[4]) / 2,
      width: num(rect?.[3]),
      height: num(rect?.[4]),
      rows: [...m[2]!.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((t) =>
        unescape(t[1]!.replace(/<\/?tspan\b[^>]*>/g, '')),
      ),
    })
  }
  const edges: RequirementLine[] = [
    ...svg.matchAll(/<polyline class="requirement-relationship"([^>]*)>/g),
  ].map((m) => {
    const a = (name: 'data-type' | 'data-src' | 'data-dst') =>
      ({
        'data-type': /data-type="([^"]*)"/,
        'data-src': /data-src="([^"]*)"/,
        'data-dst': /data-dst="([^"]*)"/,
      })[name].exec(m[1]!)?.[1]
    return {
      type: a('data-type') ?? '',
      dashed: /stroke-dasharray/.test(m[1]!),
      from: unescape(a('data-src') ?? ''),
      to: unescape(a('data-dst') ?? ''),
    }
  })
  return { boxes, edges, size: { width, height } }
}

const share = (agree: number, total: number): number | null =>
  total === 0 ? null : agree / total

const near = (a: number, b: number, tol = TOLERANCE): boolean =>
  Math.abs(a - b) <= tol

/** Box, edge, position and frame agreement of our diagram with the official one. */
export function requirementAgreement(
  official: RequirementLayout,
  ours: RequirementLayout,
): RequirementAgreement {
  const n = Math.max(official.boxes.length, ours.boxes.length)
  const mine = new Map(ours.boxes.map((b) => [b.id, b]))
  const boxes = official.boxes.filter((o) => {
    const t = mine.get(o.id)
    return (
      t !== undefined &&
      t.rows.join('\n') === o.rows.join('\n') &&
      near(o.width, t.width) &&
      near(o.height, t.height)
    )
  }).length
  const positions = official.boxes.filter((o) => {
    const t = mine.get(o.id)
    return t !== undefined && near(o.cx, t.cx) && near(o.cy, t.cy)
  }).length
  const e = Math.max(official.edges.length, ours.edges.length)
  const edges = official.edges.filter((o, i) => {
    const t = ours.edges[i]
    return (
      t !== undefined &&
      t.type === o.type &&
      t.dashed === o.dashed &&
      t.from === o.from &&
      t.to === o.to
    )
  }).length
  const frame =
    official.size !== undefined &&
    ours.size !== undefined &&
    near(official.size.width, ours.size.width, SIZE_TOLERANCE) &&
    near(official.size.height, ours.size.height, SIZE_TOLERANCE)
  return {
    boxes: share(boxes, n),
    edges: share(edges, e),
    positions: share(positions, n),
    frame: frame ? 1 : 0,
    nodes: official.boxes.length,
  }
}

/** Figures a breach is judged on; `positions` and `frame` follow the layout engine. */
export type RequirementFigure = 'boxes' | 'edges' | 'positions' | 'frame'

/** Lowest figure of a sample over `figures`, or null when it has none. */
export function worstRequirement(
  a: RequirementAgreement,
  figures: RequirementFigure[] = ['boxes', 'edges', 'positions', 'frame'],
): number | null {
  const v = figures.map((f) => a[f]).filter((x): x is number => x !== null)
  return v.length > 0 ? Math.min(...v) : null
}

/** Floor for every sample's lowest figure. */
export const REQUIREMENT_FLOOR = 1

/** One tracked data point: mean of each figure over the requirement samples. */
export interface RequirementEntry {
  kind: 'requirement'
  date: string
  commit: string
  mermaid: string
  samples: number
  boxes: number | null
  edges: number | null
  positions: number | null
  frame: number | null
}

const mean = (xs: (number | null)[]): number | null => {
  const v = xs.filter((n): n is number => n !== null)
  return v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : null
}

/** Collapse per-sample results into one history entry. */
export function summarizeRequirement(
  results: Record<string, RequirementAgreement>,
  meta: { date: string; commit: string; mermaid: string },
): RequirementEntry {
  const all = Object.values(results)
  return {
    kind: 'requirement',
    ...meta,
    samples: all.length,
    boxes: mean(all.map((r) => r.boxes)),
    edges: mean(all.map((r) => r.edges)),
    positions: mean(all.map((r) => r.positions)),
    frame: mean(all.map((r) => r.frame)),
  }
}

/** Samples under the floor; empty when within it. `errored` samples count as breaches. */
export function requirementBreaches(
  results: Record<string, RequirementAgreement>,
  errored: string[] = [],
): string[] {
  const out = errored.map((t) => `${t} (error)`)
  for (const [title, r] of Object.entries(results)) {
    const low = worstRequirement(r)
    if (low !== null && low + 1e-9 < REQUIREMENT_FLOOR) {
      out.push(
        `${title} (${Math.round(low * 100)}% < ${REQUIREMENT_FLOOR * 100}%)`,
      )
    }
  }
  return out
}
