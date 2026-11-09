/**
 * GitGraph agreement against official mermaid.js (#2808), for
 * scripts/gitgraph-oracle.ts. Browser-free so it can be unit-tested.
 *
 * A gitGraph is arithmetic: where each branch line and label box sits, the
 * route of each arrow, the commit symbols, the commit labels and tags, and the
 * size of the drawing. Items are matched by position in the document within
 * their kind (Mermaid's draw order), so a different order shows up as a
 * disagreement. Colours and fonts are not compared. Commits without an `id:`
 * get a random hex in Mermaid, which changes label widths, so samples that are
 * scored give every commit an id.
 */

export interface GitItem {
  /** Every number in the item's geometry attributes, in attribute order. */
  nums: number[]
  /** Label text, when the item is a text element. */
  text?: string
}

export interface GitGraphLayout {
  /** `branch` lines, then label boxes and label text, per branch in order. */
  branches: GitItem[]
  /** Arrow paths. */
  arrows: GitItem[]
  /** Commit symbols: circles, rects, paths and lines of `commit-bullets`. */
  commits: GitItem[]
  /** Commit label groups, rects and text, and tag polygons, holes and text. */
  labels: GitItem[]
  /** The title text, when drawn. */
  title?: GitItem
  /** viewBox width and height. */
  size?: { width: number; height: number }
}

/** Each figure is the share of agreeing items, 0..1, or null with nothing to compare. */
export interface GitGraphAgreement {
  branches: number | null
  arrows: number | null
  commits: number | null
  labels: number | null
  /** Whether the drawing size is within SIZE_TOLERANCE px and the title agrees (1 or 0). */
  frame: number | null
  /** Items compared, over all kinds. */
  items: number
}

/** Pixels; Mermaid prints float sums to many digits and measures text in the browser. */
export const TOLERANCE = 0.5
/** Pixels for the drawing size, which sums many measured widths. */
export const SIZE_TOLERANCE = 1

const GEOMETRY = [
  'x1',
  'y1',
  'x2',
  'y2',
  'x',
  'y',
  'width',
  'height',
  'cx',
  'cy',
  'r',
  'd',
  'points',
  'transform',
]

const unescape = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

const attrOf = (tag: string, name: string): string | undefined => {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag)
  return m?.[1]
}

const numbersOf = (tag: string): number[] => {
  const out: number[] = []
  for (const name of GEOMETRY) {
    const v = attrOf(tag, name)
    if (v === undefined) continue
    for (const m of v.matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi))
      out.push(Number(m[0]))
  }
  return out
}

/** Read the items and size from a gitGraph SVG; both renderers share this markup. */
export function parseGitGraphSvg(svg: string): GitGraphLayout {
  const vb = /viewBox="([^"]*)"/.exec(svg)?.[1]?.split(/\s+/).map(Number)
  const layout: GitGraphLayout = {
    branches: [],
    arrows: [],
    commits: [],
    labels: [],
  }
  if (vb) layout.size = { width: vb[2]!, height: vb[3]! }

  const body = svg.replace(/<style>[\s\S]*?<\/style>/g, '')
  const re =
    /<(line|rect|circle|path|polygon|text|g)\b([^>]*?)\/?>(?:([^<]*)<\/text>)?/g
  for (const m of body.matchAll(re)) {
    const [, name, rest = '', inner = ''] = m
    const tag = ` ${rest}`
    // A rotated LR label sits in a transformed <g> in front of its rect.
    if (
      name === 'g' &&
      body.startsWith(
        '<rect class="commit-label-bkg"',
        m.index + m[0].length + (body[m.index + m[0].length] === '\n' ? 1 : 0),
      )
    ) {
      layout.labels.push({ nums: numbersOf(tag) })
      continue
    }
    const cls = attrOf(tag, 'class') ?? ''
    const item: GitItem = { nums: numbersOf(tag) }
    if (name === 'text') item.text = unescape(inner).trim()
    if (name === 'line' && /^branch /.test(cls)) layout.branches.push(item)
    else if (name === 'rect' && /\bbranchLabelBkg\b/.test(cls))
      layout.branches.push(item)
    else if (name === 'g' && /\bbranch-label\d/.test(cls))
      layout.branches.push({ nums: numbersOf(tag) })
    else if (name === 'path' && /^arrow /.test(cls)) layout.arrows.push(item)
    else if (
      (name === 'circle' ||
        name === 'rect' ||
        name === 'path' ||
        name === 'line') &&
      /^commit /.test(cls)
    )
      layout.commits.push(item)
    else if (
      /\b(commit-label-bkg|commit-label|tag-label-bkg|tag-hole|tag-label)\b/.test(
        cls,
      )
    )
      layout.labels.push(item)
    else if (name === 'text' && /\bgitTitleText\b/.test(cls))
      layout.title = item
  }
  // The text a branch label holds (its tspans) for the branch text check.
  const rows = [
    ...body.matchAll(/<tspan[^>]*class="row"[^>]*>([^<]*)<\/tspan>/g),
  ]
  layout.branches.push(
    ...rows.map((r) => ({ nums: [], text: unescape(r[1]!).trim() })),
  )
  return layout
}

const share = (agree: number, total: number): number | null =>
  total === 0 ? null : agree / total

const near = (a: number, b: number, tol = TOLERANCE): boolean =>
  Math.abs(a - b) <= tol

const same = (a: GitItem, b: GitItem): boolean =>
  a.text === b.text &&
  a.nums.length === b.nums.length &&
  a.nums.every((n, i) => near(n, b.nums[i]!))

function figure(o: GitItem[], t: GitItem[]): [number, number] {
  const n = Math.max(o.length, t.length)
  const ok = o.filter((x, i) => t[i] !== undefined && same(x, t[i]!)).length
  return [ok, n]
}

/** Branch, arrow, commit, label and frame agreement of our gitGraph with the official one. */
export function gitGraphAgreement(
  official: GitGraphLayout,
  ours: GitGraphLayout,
): GitGraphAgreement {
  const [bo, bn] = figure(official.branches, ours.branches)
  const [ao, an] = figure(official.arrows, ours.arrows)
  const [co, cn] = figure(official.commits, ours.commits)
  const [lo, ln] = figure(official.labels, ours.labels)
  const o = official
  const t = ours
  const titleOk =
    (o.title === undefined) === (t.title === undefined) &&
    (o.title === undefined ||
      (o.title.text === t.title!.text &&
        near(o.title.nums[0]!, t.title!.nums[0]!, SIZE_TOLERANCE)))
  const frameOk =
    o.size !== undefined &&
    t.size !== undefined &&
    near(o.size.width, t.size.width, SIZE_TOLERANCE) &&
    near(o.size.height, t.size.height, SIZE_TOLERANCE) &&
    titleOk
  return {
    branches: share(bo, bn),
    arrows: share(ao, an),
    commits: share(co, cn),
    labels: share(lo, ln),
    frame: frameOk ? 1 : 0,
    items: bn + an + cn + ln,
  }
}

/** Lowest figure of a sample, or null when it has none. */
export function worstGitGraph(a: GitGraphAgreement): number | null {
  const v = [a.branches, a.arrows, a.commits, a.labels, a.frame].filter(
    (x): x is number => x !== null,
  )
  return v.length > 0 ? Math.min(...v) : null
}

/**
 * Floor for every sample's lowest figure. A sample that needs a lower one
 * should say why next to it.
 */
export const GITGRAPH_FLOOR = 1

/** Samples under the floor; empty when within it. `errored` samples count as breaches. */
export function gitGraphBreaches(
  results: Record<string, GitGraphAgreement>,
  errored: string[] = [],
): string[] {
  const out = errored.map((t) => `${t} (error)`)
  for (const [title, r] of Object.entries(results)) {
    const low = worstGitGraph(r)
    if (low !== null && low + 1e-9 < GITGRAPH_FLOOR) {
      out.push(
        `${title} (${Math.round(low * 100)}% < ${GITGRAPH_FLOOR * 100}%)`,
      )
    }
  }
  return out
}
