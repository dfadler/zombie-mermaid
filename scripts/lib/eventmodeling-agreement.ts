/**
 * Event modeling agreement against official mermaid.js, for
 * scripts/eventmodeling-oracle.ts. Browser-free so it can be unit-tested.
 *
 * An event model is arithmetic plus text measurement, so what can regress is
 * where each swimlane, box and arrow sits, how big it is (a box's height
 * encodes its measured line count, its width the text width) and the size of
 * the drawing. Both renders draw in the same coordinates, so figures are
 * compared as drawn. Colours, fonts and text are not compared (the lane labels
 * are, as text).
 */

export interface EmRect {
  x: number
  y: number
  width: number
  height: number
}

export interface EmLayout {
  lanes: Array<EmRect & { label: string }>
  boxes: EmRect[]
  /** Start and end of each arrow. */
  arrows: Array<[number, number, number, number]>
  size: { width: number; height: number }
}

/** Each figure is the share of agreeing items, 0..1, or null with nothing to compare. */
export interface EmAgreement {
  lanes: number | null
  boxes: number | null
  arrows: number | null
  /** 1 when the drawing size is within SIZE_TOLERANCE px, else 0. */
  frame: number
}

/** Pixels; box widths come from measured text, which differs by a pixel at times. */
export const TOLERANCE = 1
export const SIZE_TOLERANCE = 2

const num = (s: string | undefined): number => Number(s ?? 0)
/** The value of attribute `name` in a tag (a plain scan, no dynamic regex). */
const attr = (tag: string, name: string): string | undefined => {
  const at = tag.indexOf(` ${name}="`)
  if (at === -1) return undefined
  const from = at + name.length + 3
  return tag.slice(from, tag.indexOf('"', from))
}

const rectOf = (tag: string): EmRect => ({
  x: num(attr(tag, 'x')),
  y: num(attr(tag, 'y')),
  width: num(attr(tag, 'width')),
  height: num(attr(tag, 'height')),
})

/** Read the figures out of an official mermaid render or ours. */
export function parseEmSvg(svg: string): EmLayout {
  const [vw = 0, vh = 0] = (/viewBox="([^"]*)"/.exec(svg)?.[1] ?? '')
    .split(/\s+/)
    .map(Number)
    .slice(2)
  const layout: EmLayout = {
    lanes: [],
    boxes: [],
    arrows: [],
    size: { width: vw, height: vh },
  }
  for (const m of svg.matchAll(
    /<g class="em-swimlane">\s*<rect([^>]*)>(?:<\/rect>)?\s*<text[^>]*>([^<]*)</g,
  ))
    layout.lanes.push({ ...rectOf(m[1]!), label: m[2]! })
  for (const m of svg.matchAll(/<g class="em-box">\s*<rect([^>]*)>/g))
    layout.boxes.push(rectOf(m[1]!))
  for (const m of svg.matchAll(/<path[^>]*class="em-relation"[^>]*>/g)) {
    const d = attr(m[0], 'd') ?? ''
    const n = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((x) => Number(x[0]))
    layout.arrows.push([n[0] ?? 0, n[1] ?? 0, n[2] ?? 0, n[3] ?? 0])
  }
  return layout
}

const near = (a: number, b: number, tol = TOLERANCE): boolean =>
  Math.abs(a - b) <= tol
const sameRect = (a: EmRect, b: EmRect): boolean =>
  near(a.x, b.x) &&
  near(a.y, b.y) &&
  near(a.width, b.width) &&
  near(a.height, b.height)

function share<T>(
  official: T[],
  ours: T[],
  same: (a: T, b: T) => boolean,
): number | null {
  const total = Math.max(official.length, ours.length)
  if (total === 0) return null
  return (
    official.filter((o, i) => ours[i] !== undefined && same(o, ours[i]!))
      .length / total
  )
}

export function emAgreement(official: EmLayout, ours: EmLayout): EmAgreement {
  return {
    lanes: share(
      official.lanes,
      ours.lanes,
      (a, b) => a.label === b.label && sameRect(a, b),
    ),
    boxes: share(official.boxes, ours.boxes, sameRect),
    arrows: share(official.arrows, ours.arrows, (a, b) =>
      a.every((v, i) => near(v, b[i]!)),
    ),
    frame:
      near(official.size.width, ours.size.width, SIZE_TOLERANCE) &&
      near(official.size.height, ours.size.height, SIZE_TOLERANCE)
        ? 1
        : 0,
  }
}

/** Samples below 100% on any figure, for `--thresholds`. */
export function emBreaches(
  results: Record<string, EmAgreement>,
  errored: string[],
): string[] {
  const bad = Object.entries(results)
    .filter(([, a]) => Object.values(a).some((v) => v !== null && v < 1))
    .map(([title]) => title)
  return [...bad, ...errored]
}
