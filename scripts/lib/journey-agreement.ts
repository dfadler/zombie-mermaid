/**
 * Journey agreement against official mermaid.js (#2958), for
 * scripts/journey-oracle.ts. Browser-free so it can be unit-tested.
 *
 * A journey is arithmetic: section bars, task boxes, a dashed line and a face
 * per task (its height set by the score), a dot per actor and an arrowed axis.
 * Elements are matched by position in the drawing (Mermaid's draw order), so a
 * different order shows up as a disagreement. Colours, fonts and text are not
 * compared.
 */

export interface Box {
  x: number
  y: number
  width: number
  height: number
  /** The `section-type-N` / `task-type-N` index, or the `actor-N` class. */
  type: string
}

export interface Point {
  x: number
  y: number
  type: string
}

export interface Seg {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface JourneyLayout {
  sections: Box[]
  tasks: Box[]
  /** Face circle centres. */
  faces: Point[]
  /** Dashed task lines. */
  lines: Seg[]
  /** Actor dots, legend first then per task, in drawing order. */
  dots: Point[]
  /** The arrowed axis (stroke width 4), when drawn. */
  axis?: Seg
  /** viewBox width and height. */
  size?: { width: number; height: number }
}

/** Each figure is the share of agreeing items, 0..1, or null with nothing to compare. */
export interface JourneyAgreement {
  sections: number | null
  tasks: number | null
  faces: number | null
  lines: number | null
  dots: number | null
  /** Whether the axis and the drawing size are within SIZE_TOLERANCE px (1 or 0). */
  frame: number | null
  items: number
}

/** Pixels; Mermaid prints float sums to many digits. */
export const TOLERANCE = 0.5
/** Pixels for the axis and drawing size, which follow measured legend text. */
export const SIZE_TOLERANCE = 3

const str = (tag: string, name: string): string => {
  const at = tag.indexOf(` ${name}="`)
  if (at < 0) return ''
  const from = at + name.length + 3
  return tag.slice(from, tag.indexOf('"', from))
}
const num = (tag: string, name: string): number => Number(str(tag, name))

/**
 * Read the boxes, faces, lines, dots, axis and size from a journey SVG; both
 * renderers share this markup. Positions are relative to the viewBox origin,
 * which Mermaid moves up for a title and this renderer leaves at 0,0.
 */
export function parseJourneySvg(svg: string): JourneyLayout {
  const vb = /viewBox="([^"]*)"/.exec(svg)?.[1]?.split(/\s+/).map(Number)
  const ox = vb?.[0] ?? 0
  const oy = vb?.[1] ?? 0
  const out: JourneyLayout = {
    sections: [],
    tasks: [],
    faces: [],
    lines: [],
    dots: [],
    size: vb ? { width: vb[2]!, height: vb[3]! } : undefined,
  }
  for (const m of svg.matchAll(/<(rect|circle|line)\b[^>]*>/g)) {
    const t = m[0]
    const cls = str(t, 'class')
    if (m[1] === 'rect') {
      const kind = /\bjourney-section\b/.test(cls)
        ? out.sections
        : /\btask\b/.test(cls)
          ? out.tasks
          : undefined
      kind?.push({
        x: num(t, 'x') - ox,
        y: num(t, 'y') - oy,
        width: num(t, 'width'),
        height: num(t, 'height'),
        type: /(?:section|task)-type-(\d+)/.exec(cls)?.[1] ?? '',
      })
    } else if (m[1] === 'circle') {
      const p = { x: num(t, 'cx') - ox, y: num(t, 'cy') - oy, type: cls }
      if (cls === 'face') out.faces.push(p)
      else if (/^actor-\d+$/.test(cls)) out.dots.push(p)
    } else {
      const seg = {
        x1: num(t, 'x1') - ox,
        y1: num(t, 'y1') - oy,
        x2: num(t, 'x2') - ox,
        y2: num(t, 'y2') - oy,
      }
      if (/\btask-line\b/.test(cls)) out.lines.push(seg)
      else if (num(t, 'stroke-width') === 4) out.axis = seg
    }
  }
  return out
}

/**
 * A coordinate Mermaid printed as NaN (a non-numeric score puts the face at
 * `cy="NaN"`) is not a position, so it agrees with whatever we draw.
 */
const near = (a: number, b: number, tol = TOLERANCE): boolean =>
  Number.isNaN(a) || Math.abs(a - b) <= tol

/** Share of `official` items matched by the item at the same index in `ours`; surplus counts against. */
function matched<T>(
  official: T[],
  ours: T[],
  same: (a: T, b: T) => boolean,
): number | null {
  const n = Math.max(official.length, ours.length)
  if (n === 0) return null
  return (
    official.filter((o, i) => ours[i] !== undefined && same(o, ours[i]!))
      .length / n
  )
}

const sameBox = (a: Box, b: Box): boolean =>
  a.type === b.type &&
  near(a.x, b.x) &&
  near(a.y, b.y) &&
  near(a.width, b.width) &&
  near(a.height, b.height)
/**
 * Mermaid numbers actors past the sixth `actor-6`, `actor-7`... with the first
 * six colours repeating; this renderer wraps the class instead, so the colour
 * slot (index mod 6) is what is compared.
 */
const slot = (type: string): string => {
  const n = /^actor-(\d+)$/.exec(type)?.[1]
  return n === undefined ? type : `actor-${Number(n) % 6}`
}
const samePoint = (a: Point, b: Point): boolean =>
  slot(a.type) === slot(b.type) && near(a.x, b.x) && near(a.y, b.y)
const sameSeg = (a: Seg, b: Seg, tol = TOLERANCE): boolean =>
  near(a.x1, b.x1, tol) &&
  near(a.y1, b.y1, tol) &&
  near(a.x2, b.x2, tol) &&
  near(a.y2, b.y2, tol)

/** Section, task, face, line, dot and frame agreement of our journey with the official one. */
export function journeyAgreement(
  o: JourneyLayout,
  t: JourneyLayout,
): JourneyAgreement {
  const frameOk =
    o.size !== undefined &&
    t.size !== undefined &&
    o.axis !== undefined &&
    t.axis !== undefined &&
    near(o.size.width, t.size.width, SIZE_TOLERANCE) &&
    near(o.size.height, t.size.height, SIZE_TOLERANCE) &&
    sameSeg(o.axis, t.axis, SIZE_TOLERANCE)
  return {
    sections: matched(o.sections, t.sections, sameBox),
    tasks: matched(o.tasks, t.tasks, sameBox),
    faces: matched(o.faces, t.faces, samePoint),
    lines: matched(o.lines, t.lines, sameSeg),
    dots: matched(o.dots, t.dots, samePoint),
    frame: frameOk ? 1 : 0,
    items: o.sections.length + o.tasks.length,
  }
}

/** Lowest figure of a sample, or null when it has none. */
export function worstJourney(a: JourneyAgreement): number | null {
  const v = [a.sections, a.tasks, a.faces, a.lines, a.dots, a.frame].filter(
    (x): x is number => x !== null,
  )
  return v.length > 0 ? Math.min(...v) : null
}

/**
 * Floor for every sample's lowest figure. A sample that needs a lower one
 * should say why next to it.
 */
export const JOURNEY_FLOOR = 1

/** Samples under the floor; empty when within it. `errored` samples count as breaches. */
export function journeyBreaches(
  results: Record<string, JourneyAgreement>,
  errored: string[] = [],
): string[] {
  const out = errored.map((t) => `${t} (error)`)
  for (const [title, r] of Object.entries(results)) {
    const low = worstJourney(r)
    if (low !== null && low + 1e-9 < JOURNEY_FLOOR) {
      out.push(`${title} (${Math.round(low * 100)}% < ${JOURNEY_FLOOR * 100}%)`)
    }
  }
  return out
}
