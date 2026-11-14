/**
 * Use case diagram agreement against official mermaid.js, for
 * scripts/usecase-oracle.ts. Browser-free so it can be unit-tested.
 *
 * What is compared, per sample, as the share of agreeing items (0..1):
 *   - boxes: same id and label, and the same width and height (Mermaid sizes a
 *     node from its text, so this is the text measurement)
 *   - edges: same order, label, dotted or solid, arrowheads, and which box the
 *     line starts at and ends at
 *   - positions: boxes within TOLERANCE px of Mermaid's (dagre there, ELK
 *     here, so this is the layout, and is scored apart from the sizes)
 *   - frame: the drawing's width and height within SIZE_TOLERANCE px
 * Colours, fonts and the exact line routes are not compared.
 */

export interface UsecaseBox {
  id: string
  kind: 'actor' | 'usecase' | 'note' | 'boundary'
  /** Centre, relative to the viewBox origin. */
  cx: number
  cy: number
  width: number
  height: number
  label: string
}

export interface UsecaseLine {
  /** The relationship's label, `«include»` for include and extend. */
  label: string
  dotted: boolean
  /** Ids of the boxes at the first and last point. */
  from?: string
  to?: string
}

export interface UsecaseLayout {
  boxes: UsecaseBox[]
  edges: UsecaseLine[]
  size?: { width: number; height: number }
}

export interface UsecaseAgreement {
  boxes: number | null
  edges: number | null
  positions: number | null
  frame: number | null
  nodes: number
}

/** Pixels; Mermaid prints float sums to many digits. */
export const TOLERANCE = 0.5
/**
 * Pixels for an actor's width: its 14px name is measured with the 16px Trebuchet
 * tables, and Chromium's hinting at 14px runs up to ~1.3px wider ("Customer").
 */
export const ACTOR_TOLERANCE = 1.5
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

type Point = { x: number; y: number }

/** The box (not a boundary) whose outline `p` is nearest. */
function boxAt(boxes: UsecaseBox[], p: Point): string | undefined {
  let best: string | undefined
  let bestDist = Infinity
  for (const b of boxes) {
    if (b.kind === 'boundary') continue
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

function viewBox(svg: string): number[] {
  return (
    /viewBox="([^"]*)"/.exec(svg)?.[1]?.split(/\s+/).map(Number) ?? [0, 0, 0, 0]
  )
}

/** Read the boxes, relationships and size from official mermaid.js markup. */
export function parseOfficialUsecaseSvg(svg: string): UsecaseLayout {
  const [ox = 0, oy = 0, width = 0, height = 0] = viewBox(svg)
  const boxes: UsecaseBox[] = []
  const starts = [
    ...svg.matchAll(
      /<g class="(?:cluster|node) [^"]*"[^>]*?data-usecase-id="([^"]*)" data-usecase-kind="(actor|usecase|note|boundary)"/g,
    ),
  ]
  for (const [i, m] of starts.entries()) {
    const body = svg.slice(m.index, starts[i + 1]?.index ?? svg.length)
    const head = m[0]
    const at = /transform="translate\(([-\d.e]+), ?([-\d.e]+)\)"/.exec(head)
    const kind = m[2] as UsecaseBox['kind']
    let cx = num(at?.[1])
    let cy = num(at?.[2])
    let w = 0
    let h = 0
    const label = unescape(
      /<(?:p|text)\b[^>]*>([\s\S]*?)<\/(?:p|text)>/.exec(body)?.[1] ?? '',
    )
    if (kind === 'boundary') {
      const r =
        /<rect class="boundary-body[^"]*"[^>]*? x="([-\d.e]+)" y="([-\d.e]+)" width="([-\d.e]+)" height="([-\d.e]+)"/.exec(
          body,
        )
      w = num(r?.[3])
      h = num(r?.[4])
      cx = num(r?.[1]) + w / 2
      cy = num(r?.[2]) + h / 2
    } else if (kind === 'actor') {
      const r =
        /<rect class="usecase-actor-outline"[^>]*? width="([-\d.e]+)" height="([-\d.e]+)"/.exec(
          body,
        )
      w = num(r?.[1])
      h = num(r?.[2])
    } else if (/<ellipse\b/.test(body)) {
      const r = /<ellipse[^>]*? rx="([-\d.e]+)" ry="([-\d.e]+)"/.exec(body)
      w = num(r?.[1]) * 2
      h = num(r?.[2]) * 2
    } else {
      const r =
        /<rect class="basic[^>]*? width="([-\d.e]+)" height="([-\d.e]+)"/.exec(
          body,
        )
      const p = /<path d="M(-?[\d.e]+) (-?[\d.e]+) L/.exec(body)
      w = r ? num(r[1]) : -num(p?.[1]) * 2
      h = r ? num(r[2]) : -num(p?.[2]) * 2
    }
    boxes.push({
      id: m[1]!,
      kind,
      cx: cx - ox,
      cy: cy - oy,
      width: w,
      height: h,
      label,
    })
  }
  const labels = new Map<string, string>()
  for (const m of svg.matchAll(
    /<g class="edgeLabel"[^>]*>\s*<g class="label" data-id="([^"]*)"[\s\S]*?<p>([\s\S]*?)<\/p>/g,
  ))
    labels.set(m[1]!, unescape(m[2]!))
  const edges: UsecaseLine[] = []
  for (const m of svg.matchAll(
    /<path d="[^"]*" id="[^"]*" class="([^"]*)"[^>]*?data-points="([^"]*)"[^>]*?data-usecase-id="([^"]*)"/g,
  )) {
    const pts = JSON.parse(atob(m[2]!)) as Point[]
    const rel = (p: Point): Point => ({ x: p.x - ox, y: p.y - oy })
    edges.push({
      label: labels.get(m[3]!) ?? '',
      dotted: /edge-pattern-dotted/.test(m[1]!),
      from: boxAt(boxes, rel(pts[0]!)),
      to: boxAt(boxes, rel(pts[pts.length - 1]!)),
    })
  }
  return { boxes, edges, size: { width, height } }
}

/** Read the boxes, relationships and size from our markup. */
export function parseOurUsecaseSvg(svg: string): UsecaseLayout {
  const [, , width = 0, height = 0] = viewBox(svg)
  const boxes: UsecaseBox[] = []
  const kindOf = (shape: string): UsecaseBox['kind'] =>
    shape === 'usecase-actor'
      ? 'actor'
      : shape === 'usecase-note'
        ? 'note'
        : 'usecase'
  for (const m of svg.matchAll(
    /<g class="subgraph" data-id="([^"]*)" data-label="([^"]*)">\s*<rect x="([-\d.e]+)" y="([-\d.e]+)" width="([-\d.e]+)" height="([-\d.e]+)"/g,
  ))
    boxes.push({
      id: unescape(m[1]!),
      kind: 'boundary',
      cx: num(m[3]) + num(m[5]) / 2,
      cy: num(m[4]) + num(m[6]) / 2,
      width: num(m[5]),
      height: num(m[6]),
      label: unescape(m[2]!),
    })
  for (const m of svg.matchAll(
    /<g class="node" data-id="([^"]*)" data-label="([^"]*)" data-shape="([^"]*)">([\s\S]*?)\n<\/g>/g,
  )) {
    const body = m[4]!
    const e =
      /<ellipse cx="([-\d.e]+)" cy="([-\d.e]+)" rx="([-\d.e]+)" ry="([-\d.e]+)"/.exec(
        body,
      )
    const r =
      /<rect [^>]*?x="([-\d.e]+)" y="([-\d.e]+)" width="([-\d.e]+)" height="([-\d.e]+)"/.exec(
        body,
      )
    boxes.push({
      id: unescape(m[1]!),
      kind: kindOf(m[3]!),
      cx: e ? num(e[1]) : num(r?.[1]) + num(r?.[3]) / 2,
      cy: e ? num(e[2]) : num(r?.[2]) + num(r?.[4]) / 2,
      width: e ? num(e[3]) * 2 : num(r?.[3]),
      height: e ? num(e[4]) * 2 : num(r?.[4]),
      label: unescape(m[2]!),
    })
  }
  const edges: UsecaseLine[] = [
    ...svg.matchAll(/<path class="edge"([^>]*)>/g),
  ].map((m) => {
    // Attributes of the tag, by name (a lookup, not a pattern built from the name).
    const attrs = new Map(
      [...m[1]!.matchAll(/(?:^|\s)([\w-]+)="([^"]*)"/g)].map((x) => [
        x[1]!,
        x[2]!,
      ]),
    )
    const a = (name: string): string | undefined => attrs.get(name)
    const d = (a('d') ?? '').match(/-?[\d.]+/g)!.map(Number)
    return {
      label: unescape(a('data-label') ?? ''),
      dotted: a('data-style') === 'dotted',
      from: boxAt(boxes, { x: d[0]!, y: d[1]! }),
      to: boxAt(boxes, { x: d[d.length - 2]!, y: d[d.length - 1]! }),
    }
  })
  return { boxes, edges, size: { width, height } }
}

const share = (agree: number, total: number): number | null =>
  total === 0 ? null : agree / total

const near = (a: number, b: number, tol = TOLERANCE): boolean =>
  Math.abs(a - b) <= tol

/** Box, edge, position and frame agreement of our diagram with the official one. */
export function usecaseAgreement(
  official: UsecaseLayout,
  ours: UsecaseLayout,
): UsecaseAgreement {
  const n = Math.max(official.boxes.length, ours.boxes.length)
  const mine = new Map(ours.boxes.map((b) => [b.id, b]))
  const boxes = official.boxes.filter((o) => {
    const t = mine.get(o.id)
    return (
      t !== undefined &&
      t.kind === o.kind &&
      t.label === o.label &&
      // A boundary's size is its layout's, scored under positions and frame.
      (o.kind === 'boundary' ||
        (near(
          o.width,
          t.width,
          o.kind === 'actor' ? ACTOR_TOLERANCE : TOLERANCE,
        ) &&
          near(o.height, t.height)))
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
      t.label === o.label &&
      t.dotted === o.dotted &&
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
export type UsecaseFigure = 'boxes' | 'edges' | 'positions' | 'frame'

/** Lowest figure of a sample over `figures`, or null when it has none. */
export function worstUsecase(
  a: UsecaseAgreement,
  figures: UsecaseFigure[] = ['boxes', 'edges', 'positions', 'frame'],
): number | null {
  const v = figures.map((f) => a[f]).filter((x): x is number => x !== null)
  return v.length > 0 ? Math.min(...v) : null
}

/** Floors for every sample's lowest figure: sizes and edges must agree; layout is tracked, not gated. */
export const USECASE_FLOOR = 1
export const USECASE_GATED: UsecaseFigure[] = ['boxes', 'edges']

/** One tracked data point: mean of each figure over the use case samples. */
export interface UsecaseEntry {
  kind: 'usecase'
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
export function summarizeUsecase(
  results: Record<string, UsecaseAgreement>,
  meta: { date: string; commit: string; mermaid: string },
): UsecaseEntry {
  const all = Object.values(results)
  return {
    kind: 'usecase',
    ...meta,
    samples: all.length,
    boxes: mean(all.map((r) => r.boxes)),
    edges: mean(all.map((r) => r.edges)),
    positions: mean(all.map((r) => r.positions)),
    frame: mean(all.map((r) => r.frame)),
  }
}

/** Samples under the floor; empty when within it. `errored` samples count as breaches. */
export function usecaseBreaches(
  results: Record<string, UsecaseAgreement>,
  errored: string[] = [],
): string[] {
  const out = errored.map((t) => `${t} (error)`)
  for (const [title, r] of Object.entries(results)) {
    const low = worstUsecase(r, USECASE_GATED)
    if (low !== null && low + 1e-9 < USECASE_FLOOR) {
      out.push(`${title} (${Math.round(low * 100)}% < ${USECASE_FLOOR * 100}%)`)
    }
  }
  return out
}
