/**
 * Block diagram agreement against official mermaid.js, for scripts/block-oracle.ts.
 * Browser-free so it can be unit-tested.
 *
 * A block diagram is a grid, so what can regress is where each block sits and how
 * big it is (a label's width sets the cell size, its lines the height), the
 * corner radius of round blocks and the size of the drawing. Everything is
 * compared relative to the viewBox origin, in drawing order. Colours and fonts
 * are not compared.
 */

export interface BlockRect {
  x: number
  y: number
  width: number
  height: number
  /** Corner radius (`rx`): 5 for a round block, 0 for a square one. */
  radius: number
}

/** A drawn link: its path numbers (x, y, x, y ...) and its label's centre, relative to the viewBox origin. */
export interface BlockPath {
  path: number[]
  label: { x: number; y: number } | null
}

export interface BlockLayout {
  /** Every drawn block (leaves and groups), parents before children. */
  blocks: BlockRect[]
  /** Every drawn link, in drawing order. */
  edges: BlockPath[]
  size: { width: number; height: number }
}

/** Each figure is the share of agreeing items, 0..1, or null with nothing to compare. */
export interface BlockAgreement {
  blocks: number | null
  radii: number | null
  /** Share of links whose path points and label place agree. */
  edges: number | null
  /** 1 when the drawing size is within SIZE_TOLERANCE px, else 0. */
  frame: number
}

/** Pixels; Mermaid prints float sums to many digits and measures text in the browser. */
export const TOLERANCE = 0.5
export const SIZE_TOLERANCE = 1

const num = (s: string | undefined): number => Number(s ?? 0)
/** The value of attribute `name` in a tag (a plain scan, no dynamic regex). */
const attr = (tag: string, name: string): string | undefined => {
  const at = tag.indexOf(` ${name}="`)
  if (at === -1) return undefined
  const from = at + name.length + 3
  return tag.slice(from, tag.indexOf('"', from))
}

/** Read the figures out of an official mermaid render or ours. */
export function parseBlockSvg(svg: string): BlockLayout {
  const [vx = 0, vy = 0, vw = 0, vh = 0] = (
    /viewBox="([^"]*)"/.exec(svg)?.[1] ?? ''
  )
    .split(/\s+/)
    .map(Number)
  const layout: BlockLayout = {
    blocks: [],
    edges: [],
    size: { width: vw, height: vh },
  }
  // Ours wraps everything in translate(-vx, -vy) under a 0 0 viewBox; Mermaid
  // draws in viewBox space with a translate per node.
  const shift = /<g transform="translate\(([-\d.]+), ([-\d.]+)\)">/.exec(svg)
  const ours = shift !== null
  const [ox, oy] = ours ? [num(shift[1]), num(shift[2])] : [-vx, -vy]
  for (const g of svg.split(/<g class="node[ "]/).slice(1)) {
    const t = /transform="translate\(([-\d.]+),\s*([-\d.]+)\)"/.exec(
      g.slice(0, 300),
    )
    const [tx, ty] = ours ? [0, 0] : [num(t?.[1]), num(t?.[2])]
    const rect = /<rect[^>]*class="[^"]*label-container[^>]*>/.exec(g)?.[0]
    if (rect === undefined) continue
    layout.blocks.push({
      x: num(attr(rect, 'x')) + tx + ox,
      y: num(attr(rect, 'y')) + ty + oy,
      width: num(attr(rect, 'width')),
      height: num(attr(rect, 'height')),
      radius: num(attr(rect, 'rx')),
    })
  }
  // Links: a path (Mermaid: `flowchart-link`, ours: `edge-path`) and the label after it.
  const pathRe =
    /<path (?:class="edge-path[^"]*" d="([^"]*)"[^>]*|d="([^"]*)"[^>]*flowchart-link[^>]*)>/g
  for (const m of svg.matchAll(pathRe)) {
    const d = m[1] ?? m[2] ?? ''
    const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
    const path = nums.map((n, i) => n + (i % 2 === 0 ? ox : oy))
    const after = svg.slice((m.index ?? 0) + m[0].length)
    const next = after.search(/<path |<g class="node/)
    const chunk = next === -1 ? after : after.slice(0, next)
    let label: BlockPath['label'] = null
    const off =
      /<g class="edgeLabel" transform="translate\(([-\d.]+), ([-\d.]+)\)"/.exec(
        chunk,
      )
    if (off) label = { x: num(off[1]) + ox, y: num(off[2]) + oy }
    const mine =
      /<g class="edge-label"><rect[^>]* x="([-\d.]+)"[^>]* y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)"/.exec(
        chunk,
      )
    if (mine)
      label = {
        x: num(mine[1]) + num(mine[3]) / 2 + ox,
        y: num(mine[2]) + num(mine[4]) / 2 + oy,
      }
    layout.edges.push({ path, label })
  }
  return layout
}

const near = (a: number, b: number, tol = TOLERANCE): boolean =>
  Math.abs(a - b) <= tol
const sameRect = (a: BlockRect, b: BlockRect): boolean =>
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

export function blockAgreement(
  official: BlockLayout,
  ours: BlockLayout,
): BlockAgreement {
  return {
    blocks: share(official.blocks, ours.blocks, sameRect),
    radii: share(official.blocks, ours.blocks, (a, b) => a.radius === b.radius),
    edges: share(
      official.edges,
      ours.edges,
      (a, b) =>
        a.path.length === b.path.length &&
        a.path.every((n, i) => near(n, b.path[i]!)) &&
        (a.label === null
          ? b.label === null
          : b.label !== null &&
            near(a.label.x, b.label.x) &&
            near(a.label.y, b.label.y)),
    ),
    frame:
      near(official.size.width, ours.size.width, SIZE_TOLERANCE) &&
      near(official.size.height, ours.size.height, SIZE_TOLERANCE)
        ? 1
        : 0,
  }
}

/** Gallery samples below 100% on any figure, for `--thresholds`. */
export function blockBreaches(
  results: Record<string, BlockAgreement>,
  errored: string[],
): string[] {
  const bad = Object.entries(results)
    .filter(([, a]) => Object.values(a).some((v) => v !== null && v < 1))
    .map(([title]) => title)
  return [...bad, ...errored]
}
