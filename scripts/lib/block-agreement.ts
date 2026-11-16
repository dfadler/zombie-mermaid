/**
 * Block diagram agreement against official mermaid.js, for scripts/block-oracle.ts.
 * Browser-free so it can be unit-tested.
 *
 * A block diagram is a grid, so what can regress is where each block sits and how
 * big it is (a label's width sets the cell size, its lines the height), the
 * corner radius of round blocks, what a shape draws and the size of the drawing.
 * Everything is compared relative to the viewBox origin, in drawing order.
 * Colours and fonts are not compared.
 *
 * A block is its drawn bounding box and its centre, and for a shape other than a
 * rectangle also its geometry: a circle's radii, a polygon's points, a cylinder's
 * path. Mermaid draws a stadium and an asymmetric block as rough.js paths that
 * trace the outline in many small curves, so for those only the bounding box of
 * the path counts.
 */

export type BlockKind = 'rect' | 'circle' | 'polygon' | 'cylinder' | 'rough'

export interface BlockRect {
  kind: BlockKind
  /** Bounding box of what is drawn. */
  x: number
  y: number
  width: number
  height: number
  /** The block's centre (Mermaid's node `translate`). */
  cx: number
  cy: number
  /** Circle radii (outer, then inner), polygon points (x, y ...), cylinder path numbers; empty for the rest. */
  geom: number[]
  /** Corner radius (`rx`): 5 for a round block, 0 for a square one. */
  radius: number
  /** The rect's inline style and the label colour, `name:value` items sorted (`!important` dropped). */
  style: string
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
  /** Share of blocks whose inline styles (fill, stroke, label colour ...) agree. */
  styles: number | null
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
  const nums = (d: string): number[] =>
    (d.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g) ?? []).map(Number)
  const bounds = (xs: number[], ys: number[]) => ({
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  })
  const translate = (tag: string): [number, number] => {
    const m = /transform="translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)"/.exec(tag)
    return [num(m?.[1]), num(m?.[2])]
  }
  for (const g of svg.split(/<g class="node[ "]/).slice(1)) {
    const [tx, ty] = translate(g.slice(0, 300))
    const first =
      /<(rect|circle|polygon|path|g)\b[^>]*class="[^"]*label-container[^>]*>/.exec(
        g,
      )
    if (first === undefined || first === null) continue
    const own = (attr(first[0], 'style') ?? '')
      .split(';')
      .map((x) => x.replace(/\s*!important/, '').trim())
      .filter(Boolean)
    const color =
      /<g class="label" style="color:\s*([^;"]*?)(?: !important)?"/.exec(
        g,
      )?.[1] ?? /<text class="block-label" style="fill:([^"]*)"/.exec(g)?.[1]
    if (color !== undefined) own.push(`color:${color}`)
    const base = {
      cx: tx + ox,
      cy: ty + oy,
      radius: 0,
      style: own.sort().join(';'),
    }
    const tag = first[1]
    if (tag === 'rect') {
      const x = num(attr(first[0], 'x')) + tx + ox
      const y = num(attr(first[0], 'y')) + ty + oy
      const width = num(attr(first[0], 'width'))
      const height = num(attr(first[0], 'height'))
      layout.blocks.push({
        ...base,
        kind: 'rect',
        geom: [],
        x,
        y,
        width,
        height,
        cx: x + width / 2,
        cy: y + height / 2,
        radius: num(attr(first[0], 'rx')),
      })
    } else if (
      tag === 'circle' ||
      (tag === 'g' && g.includes('outer-circle'))
    ) {
      const radii = [...g.matchAll(/<circle\b[^>]*>/g)]
        .map((c) => c[0])
        .filter((c) =>
          /class="[^"]*(outer|inner)-circle|label-container/.test(c),
        )
        .map((c) => num(attr(c, 'r')))
      const r = Math.max(...radii)
      layout.blocks.push({
        ...base,
        kind: 'circle',
        geom: radii.sort((a, b) => b - a),
        x: tx + ox - r,
        y: ty + oy - r,
        width: 2 * r,
        height: 2 * r,
      })
    } else if (
      tag === 'polygon' &&
      !/shape-(stadium|rect_left_inv_arrow)/.test(g.slice(0, 80))
    ) {
      const pts = nums(attr(first[0], 'points') ?? '')
      const [px, py] = translate(first[0])
      const xs = pts.filter((_, i) => i % 2 === 0).map((n) => n + px + tx + ox)
      const ys = pts.filter((_, i) => i % 2 === 1).map((n) => n + py + ty + oy)
      layout.blocks.push({
        ...base,
        kind: 'polygon',
        geom: xs.flatMap((x, i) => [x, ys[i]!]),
        ...bounds(xs, ys),
      })
    } else if (tag === 'polygon') {
      // Ours, a stadium or an asymmetric block: a polygon where Mermaid has a rough path.
      const pts = nums(attr(first[0], 'points') ?? '')
      const xs = pts.filter((_, i) => i % 2 === 0).map((n) => n + tx + ox)
      const ys = pts.filter((_, i) => i % 2 === 1).map((n) => n + ty + oy)
      layout.blocks.push({
        ...base,
        kind: 'rough',
        geom: [],
        ...bounds(xs, ys),
      })
    } else if (tag === 'path' && /\sd="M0,/.test(first[0])) {
      const n = nums(attr(first[0], 'd') ?? '')
      const [px, py] = translate(first[0])
      const [w, ry, h] = [n[7]!, n[1]!, n[17]!]
      layout.blocks.push({
        ...base,
        kind: 'cylinder',
        geom: [px, py, ...n],
        x: px + tx + ox,
        y: py + ty + oy,
        width: w,
        height: h + 2 * ry,
      })
    } else {
      // Mermaid's rough.js group: absolute path numbers, moved by the group's own transform.
      const [px, py] = translate(first[0])
      const own = g.slice(g.indexOf(first[0]))
      // Only this node's own group: the links drawn after it are not part of the shape.
      const group = own.slice(0, own.indexOf('</g>') + 4)
      const all = [...group.matchAll(/<path\b[^>]*\sd="([^"]*)"/g)].flatMap(
        (m) => nums(m[1]!),
      )
      const xs = all.filter((_, i) => i % 2 === 0).map((n) => n + px + tx + ox)
      const ys = all.filter((_, i) => i % 2 === 1).map((n) => n + py + ty + oy)
      layout.blocks.push({
        ...base,
        kind: 'rough',
        geom: [],
        ...bounds(xs, ys),
      })
    }
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
  a.kind === b.kind &&
  near(a.x, b.x) &&
  near(a.y, b.y) &&
  near(a.width, b.width) &&
  near(a.height, b.height) &&
  near(a.cx, b.cx) &&
  near(a.cy, b.cy) &&
  a.geom.length === b.geom.length &&
  a.geom.every((n, i) => near(n, b.geom[i]!))

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
    styles: share(official.blocks, ours.blocks, (a, b) => a.style === b.style),
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
