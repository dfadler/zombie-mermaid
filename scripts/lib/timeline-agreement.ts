/**
 * Timeline agreement against official mermaid.js (#2845), for
 * scripts/timeline-oracle.ts. Browser-free so it can be unit-tested.
 *
 * A timeline is arithmetic plus line breaks, so what can regress is where each
 * box sits and how tall it is, the lines its text wraps to, the dashed
 * connectors, the main axis and the size of the drawing. Boxes are matched by
 * position in the drawing (sections, periods and events in Mermaid's draw
 * order), so a different order shows up as a disagreement. Colours and fonts
 * are not compared.
 */

export interface TimelineNode {
  kind: 'section' | 'period' | 'event'
  x: number
  y: number
  height: number
  /** Wrapped text lines, whitespace collapsed. */
  lines: string[]
}

export interface TimelineLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface TimelineLayout {
  nodes: TimelineNode[]
  /** The dashed lines, in drawing order. */
  connectors: TimelineLine[]
  /** The arrowed main axis (stroke width 4), when drawn. */
  axis?: TimelineLine
  /** viewBox width and height. */
  size?: { width: number; height: number }
}

/** Each figure is the share of agreeing items, 0..1, or null with nothing to compare. */
export interface TimelineAgreement {
  /** Boxes whose position and height are within TOLERANCE px. */
  boxes: number | null
  /** Boxes whose text wraps to the same lines. */
  lines: number | null
  /** Dashed connectors within TOLERANCE px. */
  connectors: number | null
  /** Whether the axis and the drawing size are within SIZE_TOLERANCE px (1 or 0). */
  frame: number | null
  nodes: number
}

/** Pixels; Mermaid prints float sums to many digits. */
export const TOLERANCE = 0.5
/**
 * Pixels for the drawing size: a title is measured in the browser there and by
 * summing font advances here, so a wide title can differ by a pixel or two.
 */
export const SIZE_TOLERANCE = 3

const unescape = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

const attr = (tag: string, name: string): number | undefined => {
  const at = tag.indexOf(` ${name}="`)
  if (at < 0) return undefined
  const from = at + name.length + 3
  return Number(tag.slice(from, tag.indexOf('"', from)))
}

/**
 * Read the boxes, lines and size from a timeline SVG; both renderers share this
 * markup. Positions are relative to the viewBox origin, which Mermaid leaves
 * at the content's corner and this renderer moves to 0,0.
 */
export function parseTimelineSvg(svg: string): TimelineLayout {
  const vb = /viewBox="([^"]*)"/.exec(svg)?.[1]?.split(/\s+/).map(Number)
  const ox = vb?.[0] ?? 0
  const oy = vb?.[1] ?? 0
  const nodes: TimelineNode[] = []
  const starts = [
    ...svg.matchAll(
      /<g (?:class="(\w+)" )?transform="translate\(([-\d.e]+), ([-\d.e]+)\)">\s*<g class="timeline-node/g,
    ),
  ]
  starts.forEach((m, i) => {
    const body = svg.slice(m.index, starts[i + 1]?.index ?? svg.length)
    const height = Number(
      /<line class="node-line-?[-\d]*" x1="0" y1="([-\d.e]+)"/.exec(body)?.[1],
    )
    const lines = [...body.matchAll(/<tspan\b[^>]*>([\s\S]*?)<\/tspan>/g)].map(
      (t) => unescape(t[1]!).replace(/\s+/g, ' ').trim(),
    )
    // Mermaid keeps the whitespace after a label (this parser trims it), which
    // after a word wider than the box adds an invisible last line.
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
    const kind =
      m[1] === 'taskWrapper'
        ? 'period'
        : m[1] === 'eventWrapper'
          ? 'event'
          : 'section'
    nodes.push({
      kind,
      x: Number(m[2]) - ox,
      y: Number(m[3]) - oy,
      height,
      lines,
    })
  })

  const connectors: TimelineLine[] = []
  let axis: TimelineLine | undefined
  for (const m of svg.matchAll(/<g class="lineWrapper"><line\b[^>]*>/g)) {
    const t = m[0]
    const line = {
      x1: attr(t, 'x1')! - ox,
      y1: attr(t, 'y1')! - oy,
      x2: attr(t, 'x2')! - ox,
      y2: attr(t, 'y2')! - oy,
    }
    if (attr(t, 'stroke-width') === 4) axis = line
    else connectors.push(line)
  }
  const size = vb ? { width: vb[2]!, height: vb[3]! } : undefined
  return { nodes, connectors, axis, size }
}

const share = (agree: number, total: number): number | null =>
  total === 0 ? null : agree / total

const near = (a: number, b: number, tol = TOLERANCE): boolean =>
  Math.abs(a - b) <= tol

/** Box, line, connector and frame agreement of our timeline with the official one. */
export function timelineAgreement(
  official: TimelineLayout,
  ours: TimelineLayout,
): TimelineAgreement {
  // Surplus or missing items count as disagreements.
  const n = Math.max(official.nodes.length, ours.nodes.length)
  const boxes = official.nodes.filter((o, i) => {
    const t = ours.nodes[i]
    return (
      t !== undefined &&
      t.kind === o.kind &&
      near(o.x, t.x) &&
      near(o.y, t.y) &&
      near(o.height, t.height)
    )
  }).length
  const lines = official.nodes.filter((o, i) => {
    const t = ours.nodes[i]
    return t !== undefined && o.lines.join('\n') === t.lines.join('\n')
  }).length
  const c = Math.max(official.connectors.length, ours.connectors.length)
  const connectors = official.connectors.filter((o, i) => {
    const t = ours.connectors[i]
    return (
      t !== undefined &&
      near(o.x1, t.x1) &&
      near(o.y1, t.y1) &&
      near(o.x2, t.x2) &&
      near(o.y2, t.y2)
    )
  }).length
  // The axis is compared by position as well as size, so a wrong end shows.
  const o = official
  const t = ours
  const frameOk =
    o.size !== undefined &&
    t.size !== undefined &&
    o.axis !== undefined &&
    t.axis !== undefined &&
    near(o.size.width, t.size.width, SIZE_TOLERANCE) &&
    near(o.size.height, t.size.height, SIZE_TOLERANCE) &&
    near(o.axis.x1, t.axis.x1, SIZE_TOLERANCE) &&
    near(o.axis.y1, t.axis.y1, SIZE_TOLERANCE) &&
    near(o.axis.x2, t.axis.x2, SIZE_TOLERANCE) &&
    near(o.axis.y2, t.axis.y2, SIZE_TOLERANCE)
  return {
    boxes: share(boxes, n),
    lines: share(lines, n),
    connectors: share(connectors, c),
    frame: frameOk ? 1 : 0,
    nodes: official.nodes.length,
  }
}

/** Lowest figure of a sample, or null when it has none. */
export function worstTimeline(a: TimelineAgreement): number | null {
  const v = [a.boxes, a.lines, a.connectors, a.frame].filter(
    (x): x is number => x !== null,
  )
  return v.length > 0 ? Math.min(...v) : null
}

/**
 * Floor for every sample's lowest figure. A sample that needs a lower one
 * should say why next to it.
 */
export const TIMELINE_FLOOR = 1

/** One tracked timeline data point: mean of each figure over the timeline samples. */
export interface TimelineEntry {
  kind: 'timeline'
  date: string
  commit: string
  mermaid: string
  samples: number
  boxes: number | null
  lines: number | null
  connectors: number | null
  frame: number | null
}

const mean = (xs: (number | null)[]): number | null => {
  const v = xs.filter((n): n is number => n !== null)
  return v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : null
}

/** Collapse per-sample results into one history entry. */
export function summarizeTimeline(
  results: Record<string, TimelineAgreement>,
  meta: { date: string; commit: string; mermaid: string },
): TimelineEntry {
  const all = Object.values(results)
  return {
    kind: 'timeline',
    ...meta,
    samples: all.length,
    boxes: mean(all.map((r) => r.boxes)),
    lines: mean(all.map((r) => r.lines)),
    connectors: mean(all.map((r) => r.connectors)),
    frame: mean(all.map((r) => r.frame)),
  }
}

/** Samples under the floor; empty when within it. `errored` samples count as breaches. */
export function timelineBreaches(
  results: Record<string, TimelineAgreement>,
  errored: string[] = [],
): string[] {
  const out = errored.map((t) => `${t} (error)`)
  for (const [title, r] of Object.entries(results)) {
    const low = worstTimeline(r)
    if (low !== null && low + 1e-9 < TIMELINE_FLOOR) {
      out.push(
        `${title} (${Math.round(low * 100)}% < ${TIMELINE_FLOOR * 100}%)`,
      )
    }
  }
  return out
}
