/**
 * C4 box placement and relationship agreement against official mermaid.js
 * (#2451), for scripts/c4-oracle.ts. Browser-free so it can be unit-tested.
 *
 * C4 is not laid out by a graph engine: mermaid puts the shapes on a fixed
 * grid in source order and draws boundaries around them. So node placement
 * (layout-agreement.ts) says nothing; what can still regress is which box sits
 * left/right/above/below which, which boundary holds it, and the text and
 * direction of each relationship. Only relative placement is compared (within
 * `PLACE_TOLERANCE`), so font and padding differences do not count.
 */

/** A box, located by the anchor of its name text (same point in both renderers). */
export interface C4Box {
  x: number
  y: number
}

export interface C4Layout {
  boxes: Record<string, C4Box>
  boundaries: { label: string; x: number; y: number; w: number; h: number }[]
  /** Relationships in source order: text and the straight line from start to end. */
  rels: { text: string; x1: number; y1: number; x2: number; y2: number }[]
}

/** Each figure is the share of agreeing pairs/items, 0..1, or null with nothing to compare. */
export interface C4Agreement {
  /** Box pairs on the same side (left/right/same column) of each other. */
  horizontal: number | null
  /** Box pairs on the same side (above/below/same row) of each other. */
  vertical: number | null
  /** Boxes inside the same set of boundaries. */
  containment: number | null
  /** Relationships with the same label and technology text. */
  relationships: number | null
  /** Relationships running the same way (left/right, up/down). */
  direction: number | null
  boxes: number
  rels: number
}

/** Pixels within which two centres count as one row or column. */
export const PLACE_TOLERANCE = 20

const attr = (tag: string, name: string): string | undefined => {
  const start = tag.indexOf(` ${name}="`)
  if (start < 0) return undefined
  const from = start + name.length + 3
  return tag.slice(from, tag.indexOf('"', from))
}

const nums = (s: string | undefined): number[] =>
  (s?.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)

const decode = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')

/** Plain text of a fragment: tags dropped in one pass, then the entities that matter. */
export function strip(html: string): string {
  let out = ''
  let inTag = false
  for (const ch of html) {
    if (ch === '<') inTag = true
    else if (ch === '>' && inTag) inTag = false
    else if (!inTag) out += ch
  }
  return decode(out).replace(/\s+/g, ' ').trim()
}

const translate = (tag: string): [number, number] => {
  const [x = 0, y = 0] = nums(attr(tag, 'transform'))
  return [x, y]
}

/** Both ends of a line or path: its first and last coordinate pairs. */
function ends(tag: string): [number, number, number, number] | undefined {
  const v = tag.startsWith('<line')
    ? ['x1', 'y1', 'x2', 'y2'].map((n) => nums(attr(tag, n))[0])
    : nums(attr(tag, 'd')).filter((_, i, a) => i < 2 || i >= a.length - 2)
  return v.length === 4 && v.every((n) => n !== undefined)
    ? (v as [number, number, number, number])
    : undefined
}

/** Official mermaid: `g.node.c4-shape#<svg>-<id>` under a centre translate, boundaries and relationships as plain groups. */
export function parseOfficialC4(svg: string): C4Layout {
  const prefix = `${/<svg\b[^>]*\bid="([^"]*)"/.exec(svg)?.[1] ?? ''}-`
  const boxes: C4Layout['boxes'] = {}
  const nodeRe =
    /<g transform="translate\(([-\d.]+), ?([-\d.]+)\)"><g class="node c4-shape[^"]*" id="([^"]+)">/g
  const found = [...svg.matchAll(nodeRe)]
  for (const [i, m] of found.entries()) {
    const chunk = svg.slice(
      m.index,
      found[i + 1]?.index ?? svg.indexOf('<g><rect', m.index),
    )
    const label = /<g class="label"[^>]*>/.exec(chunk)
    const name = /<g class="c4-name"[^>]*>/.exec(chunk)
    if (!label || !name) continue
    boxes[m[3]!.slice(prefix.length)] = {
      x: Number(m[1]),
      y: Number(m[2]) + translate(label[0])[1] + translate(name[0])[1],
    }
  }
  const boundaries: C4Layout['boundaries'] = []
  for (const m of svg.matchAll(
    /<g><rect\b[^>]*stroke-dasharray[^>]*>[\s\S]*?<\/g>/g,
  )) {
    const rect = /<rect\b[^>]*>/.exec(m[0])![0]
    const [x, y, w, h] = ['x', 'y', 'width', 'height'].map(
      (n) => nums(attr(rect, n))[0] ?? NaN,
    ) as [number, number, number, number]
    const label = /<text\b[^>]*>([\s\S]*?)<\/text>/.exec(m[0])?.[1] ?? ''
    boundaries.push({ label: strip(label), x, y, w, h })
  }
  const rels: C4Layout['rels'] = []
  const relRe =
    /<(?:line|path)\b[^>]*marker-(?:end|start)[^>]*>|<text\b[^>]*font-size: 12px[^>]*>[\s\S]*?<\/text>/g
  const first = /<(?:line|path)\b[^>]*marker-(?:end|start)/.exec(svg)
  for (const m of (first ? svg.slice(first.index) : '').matchAll(relRe)) {
    if (m[0].startsWith('<text')) {
      const last = rels[rels.length - 1]
      if (last) last.text += `${last.text ? ' | ' : ''}${strip(m[0])}`
      continue
    }
    const e = ends(m[0])
    if (e) rels.push({ text: '', x1: e[0], y1: e[1], x2: e[2], y2: e[3] })
  }
  return { boxes, boundaries, rels }
}

/** Our renderer: `g.c4-element[data-id]`, `g.c4-boundary` and `path.c4-relationship`. */
export function parseOurC4(svg: string): C4Layout {
  const boxes: C4Layout['boxes'] = {}
  for (const m of svg.matchAll(
    /<g\b[^>]*class="c4-element"[^>]*>([\s\S]*?)<\/g>/g,
  )) {
    const text = /<text\b[^>]*>/.exec(m[1]!)
    const id = attr(m[0], 'data-id')
    const x = nums(text && attr(text[0], 'x'))[0]
    const y = nums(text && attr(text[0], 'y'))[0]
    if (id !== undefined && x !== undefined && y !== undefined) {
      boxes[id] = { x, y }
    }
  }
  const boundaries: C4Layout['boundaries'] = []
  for (const m of svg.matchAll(
    /<g\b[^>]*class="c4-boundary"[^>]*>([\s\S]*?)<\/g>/g,
  )) {
    const rect = /<rect\b[^>]*>/.exec(m[1]!)?.[0] ?? ''
    const [x, y, w, h] = ['x', 'y', 'width', 'height'].map(
      (n) => nums(attr(rect, n))[0] ?? NaN,
    ) as [number, number, number, number]
    boundaries.push({
      label: decode(attr(m[0], 'data-label') ?? ''),
      x,
      y,
      w,
      h,
    })
  }
  const rels: C4Layout['rels'] = []
  for (const m of svg.matchAll(/<path\b[^>]*class="c4-relationship"[^>]*>/g)) {
    const e = ends(m[0])
    const tech = decode(attr(m[0], 'data-technology') ?? '')
    const label = decode(attr(m[0], 'data-label') ?? '')
    if (e) {
      rels.push({
        text: tech ? `${label} | [${tech}]` : label,
        x1: e[0],
        y1: e[1],
        x2: e[2],
        y2: e[3],
      })
    }
  }
  return { boxes, boundaries, rels }
}

const share = (agree: number, total: number): number | null =>
  total === 0 ? null : agree / total

/** -1, 0 (same row/column within tolerance) or 1; NaN when either side is missing. */
const side = (a: number | undefined, b: number | undefined): number =>
  a === undefined || b === undefined
    ? NaN
    : Math.abs(a - b) <= PLACE_TOLERANCE
      ? 0
      : Math.sign(a - b)

const inside = (l: C4Layout, id: string): string => {
  const b = l.boxes[id]
  return b === undefined
    ? '?'
    : l.boundaries
        .filter(
          (r) =>
            b.x >= r.x && b.x <= r.x + r.w && b.y >= r.y && b.y <= r.y + r.h,
        )
        .map((r) => r.label)
        .sort()
        .join('/')
}

/** Placement, containment, relationship text and direction agreement of our C4 with the official one. */
export function c4Agreement(official: C4Layout, ours: C4Layout): C4Agreement {
  const ids = Object.keys(official.boxes).sort()
  let hPairs = 0
  let hAgree = 0
  let vAgree = 0
  for (const [i, a] of ids.entries()) {
    for (const b of ids.slice(i + 1)) {
      const [oa, ob] = [official.boxes[a], official.boxes[b]]
      const [ua, ub] = [ours.boxes[a], ours.boxes[b]]
      hPairs++
      if (side(oa?.x, ob?.x) === side(ua?.x, ub?.x)) hAgree++
      if (side(oa?.y, ob?.y) === side(ua?.y, ub?.y)) vAgree++
    }
  }
  const noBoundaries =
    official.boundaries.length === 0 && ours.boundaries.length === 0
  const contained = ids.filter(
    (id) => inside(official, id) === inside(ours, id),
  )

  const rels = official.rels
  const dir = (r: C4Layout['rels'][number] | undefined): string =>
    r ? `${side(r.x2, r.x1)}${side(r.y2, r.y1)}` : '?'
  return {
    horizontal: share(hAgree, hPairs),
    vertical: share(vAgree, hPairs),
    containment: noBoundaries ? null : share(contained.length, ids.length),
    relationships: share(
      rels.filter((r, i) => r.text === ours.rels[i]?.text).length,
      Math.max(rels.length, ours.rels.length),
    ),
    direction: share(
      rels.filter((r, i) => dir(r) === dir(ours.rels[i])).length,
      rels.length,
    ),
    boxes: ids.length,
    rels: rels.length,
  }
}

/** Lowest figure of a sample, or null when it has none. */
export function worstC4(a: C4Agreement): number | null {
  const v = [
    a.horizontal,
    a.vertical,
    a.containment,
    a.relationships,
    a.direction,
  ].filter((n): n is number => n !== null)
  return v.length > 0 ? Math.min(...v) : null
}

/**
 * Floor for every sample's lowest figure. Everything agrees today, so any
 * disagreement is a regression: no per-sample overrides, and a sample that
 * needs one should say why next to it.
 */
export const C4_FLOOR = 1

/**
 * Samples held below `C4_FLOOR` because we really differ (mermaid 12.2.0): the
 * queue in a boundary of five boxes lands in a fourth column far to the right,
 * where mermaid wraps the boundary to three columns. Floors sit just under the
 * measured figure so the gap cannot widen; raise them as it closes.
 */
export const C4_SAMPLE_FLOORS: Readonly<Record<string, number>> = {
  'C4: Container With Boundary And BiRel': 0.7,
}

/** One tracked C4 data point (#2451, scripts/c4-oracle.ts): mean of each figure over the C4 samples. */
export interface C4Entry {
  kind: 'c4'
  date: string
  commit: string
  mermaid: string
  samples: number
  horizontal: number | null
  vertical: number | null
  containment: number | null
  relationships: number | null
  direction: number | null
}

const mean = (xs: (number | null)[]): number | null => {
  const v = xs.filter((n): n is number => n !== null)
  return v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : null
}

/** Collapse per-sample results into one history entry. */
export function summarizeC4(
  results: Record<string, C4Agreement>,
  meta: { date: string; commit: string; mermaid: string },
): C4Entry {
  const all = Object.values(results)
  return {
    kind: 'c4',
    ...meta,
    samples: all.length,
    horizontal: mean(all.map((r) => r.horizontal)),
    vertical: mean(all.map((r) => r.vertical)),
    containment: mean(all.map((r) => r.containment)),
    relationships: mean(all.map((r) => r.relationships)),
    direction: mean(all.map((r) => r.direction)),
  }
}

/** Samples under the floor; empty when within it. `errored` samples count as breaches. */
export function c4Breaches(
  results: Record<string, C4Agreement>,
  errored: string[] = [],
): string[] {
  const out = errored.map((t) => `${t} (error)`)
  for (const [title, r] of Object.entries(results)) {
    const low = worstC4(r)
    const floor = C4_SAMPLE_FLOORS[title] ?? C4_FLOOR
    if (low !== null && low + 1e-9 < floor) {
      out.push(`${title} (${Math.round(low * 100)}% < ${floor * 100}%)`)
    }
  }
  return out
}
