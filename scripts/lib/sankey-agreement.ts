/**
 * Sankey agreement against official mermaid.js (#2953), for
 * scripts/sankey-oracle.ts. Browser-free so it can be unit-tested.
 *
 * A sankey is d3-sankey arithmetic plus a bounding box, so what can regress is
 * where each bar, label and ribbon sits and the size of the drawing. Items are
 * matched by position in the drawing (Mermaid's draw order). Colours and fonts
 * are not compared. Coordinates are relative to the viewBox origin, which
 * Mermaid leaves at the content's corner and this renderer moves to 0,0.
 */

export interface SankeyBar {
  x: number
  y: number
  width: number
  height: number
}
export interface SankeyText {
  x: number
  y: number
  anchor: string
  /** Text with whitespace (Mermaid's line break) collapsed. */
  text: string
}
export interface SankeyRibbon {
  /** Every number in the path, then the stroke width. */
  nums: number[]
}
export interface SankeyLayout {
  bars: SankeyBar[]
  labels: SankeyText[]
  ribbons: SankeyRibbon[]
  /** viewBox width and height. */
  size?: { width: number; height: number }
}

/** Each figure is the share of agreeing items, 0..1, or null with nothing to compare. */
export interface SankeyAgreement {
  bars: number | null
  labels: number | null
  ribbons: number | null
  /** Whether the drawing size agrees (1 or 0). */
  frame: number | null
  nodes: number
}

/** How much wider than Mermaid's the drawing may be, as a share: the label padding. */
export const WIDTH_ALLOWANCE = 0.05

/** Pixels; Mermaid prints float sums to many digits. */
export const TOLERANCE = 0.01

const unescape = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

const attr = (tag: string, name: string): string | undefined => {
  const at = tag.indexOf(` ${name}="`)
  if (at < 0) return undefined
  const from = at + name.length + 3
  return tag.slice(from, tag.indexOf('"', from))
}

const nums = (s: string): number[] =>
  (s.match(/-?[\d.]+(?:e-?\d+)?/g) ?? []).map(Number)

/** Read the bars, labels, ribbons and size from a sankey SVG; both renderers share this markup. */
export function parseSankeySvg(svg: string): SankeyLayout {
  const vb = /viewBox="([^"]*)"/.exec(svg)?.[1]
  const [vx = 0, vy = 0, vw, vh] = vb ? nums(vb) : []
  const bars: SankeyBar[] = []
  for (const m of svg.matchAll(
    /<g class="node"[^>]*transform="translate\(([^)]*)\)"[^>]*>\s*<rect([^>]*)>/g,
  )) {
    const [x = 0, y = 0] = nums(m[1]!)
    bars.push({
      x: x - vx,
      y: y - vy,
      width: Number(attr(m[2]!, 'width')),
      height: Number(attr(m[2]!, 'height')),
    })
  }
  const labels: SankeyText[] = []
  const group =
    /<g class="node-labels"[^>]*>([\s\S]*?)<\/g>/.exec(svg)?.[1] ?? ''
  for (const m of group.matchAll(/<text([^>]*)>([\s\S]*?)<\/text>/g)) {
    labels.push({
      x: Number(attr(m[1]!, 'x')) - vx,
      y: Number(attr(m[1]!, 'y')) - vy,
      anchor: attr(m[1]!, 'text-anchor') ?? '',
      text: unescape(m[2]!).replace(/\s+/g, ' ').trim(),
    })
  }
  const ribbons: SankeyRibbon[] = []
  for (const m of svg.matchAll(/<g class="link"[^>]*>[\s\S]*?<path([^>]*)>/g)) {
    const d = nums(attr(m[1]!, 'd') ?? '')
    // M x,y C mx,y mx,y x,y: shift the x and y of each point by the origin.
    const shifted = d.map((n, i) => n - (i % 2 === 0 ? vx : vy))
    ribbons.push({ nums: [...shifted, Number(attr(m[1]!, 'stroke-width'))] })
  }
  return {
    bars,
    labels,
    ribbons,
    size:
      vw !== undefined && vh !== undefined
        ? { width: vw, height: vh }
        : undefined,
  }
}

const near = (a: number, b: number): boolean => Math.abs(a - b) <= TOLERANCE

const share = (ok: number, n: number): number | null =>
  n === 0 ? null : ok / n

export function sankeyAgreement(
  official: SankeyLayout,
  ours: SankeyLayout,
): SankeyAgreement {
  const count = (a: unknown[], b: unknown[]): number =>
    Math.max(a.length, b.length)
  // Labels are drawn in Inter but sized from Trebuchet, so ours pads the
  // overhang (SANKEY.labelFit): the whole drawing sits `dx` further right.
  const dx =
    official.bars[0] && ours.bars[0] ? official.bars[0].x - ours.bars[0].x : 0
  let bars = 0
  for (const [i, o] of official.bars.entries()) {
    const t = ours.bars[i]
    if (
      t &&
      near(o.x, t.x + dx) &&
      near(o.y, t.y) &&
      near(o.width, t.width) &&
      near(o.height, t.height)
    )
      bars++
  }
  let labels = 0
  for (const [i, o] of official.labels.entries()) {
    const t = ours.labels[i]
    if (
      t &&
      o.text === t.text &&
      o.anchor === t.anchor &&
      near(o.x, t.x + dx) &&
      near(o.y, t.y)
    )
      labels++
  }
  let ribbons = 0
  for (const [i, o] of official.ribbons.entries()) {
    const t = ours.ribbons[i]
    if (
      t &&
      o.nums.length === t.nums.length &&
      o.nums.every((n, k) =>
        near(n, t.nums[k]! + (k % 2 === 0 && k < 8 ? dx : 0)),
      )
    )
      ribbons++
  }
  const frameOk =
    official.size !== undefined &&
    ours.size !== undefined &&
    ours.size.width >= official.size.width - TOLERANCE &&
    ours.size.width <= official.size.width * (1 + WIDTH_ALLOWANCE) &&
    near(official.size.height, ours.size.height)
  return {
    bars: share(bars, count(official.bars, ours.bars)),
    labels: share(labels, count(official.labels, ours.labels)),
    ribbons: share(ribbons, count(official.ribbons, ours.ribbons)),
    frame: frameOk ? 1 : 0,
    nodes: official.bars.length,
  }
}

/** Lowest figure of a sample, or null when it has none. */
export function worstSankey(a: SankeyAgreement): number | null {
  const v = [a.bars, a.labels, a.ribbons, a.frame].filter(
    (x): x is number => x !== null,
  )
  return v.length > 0 ? Math.min(...v) : null
}

/** Floor for every sample's lowest figure. */
export const SANKEY_FLOOR = 1

/** Samples under the floor; empty when within it. `errored` samples count as breaches. */
export function sankeyBreaches(
  results: Record<string, SankeyAgreement>,
  errored: string[] = [],
): string[] {
  const out = errored.map((t) => `${t} (error)`)
  for (const [title, r] of Object.entries(results)) {
    const low = worstSankey(r)
    if (low !== null && low + 1e-9 < SANKEY_FLOOR) {
      out.push(`${title} (${Math.round(low * 100)}% < ${SANKEY_FLOOR * 100}%)`)
    }
  }
  return out
}
