/**
 * Treemap agreement against official mermaid.js, for scripts/treemap-oracle.ts.
 * Browser-free so it can be unit-tested.
 *
 * A treemap is d3's squarified layout plus text fitting, so what can regress is
 * where each section and leaf sits, which labels survive, and the drawing size.
 * Items are matched by position in the drawing (Mermaid's draw order: sections
 * breadth-first, then leaves). Colours are not compared. Coordinates are
 * relative to the viewBox origin, which Mermaid leaves at the content's corner
 * and this renderer moves to 0,0.
 */

export interface TreemapBox {
  x: number
  y: number
  width: number
  height: number
}
export interface TreemapText {
  kind: string
  text: string
  /** Font size in px, when set on the element. */
  size?: number
}
export interface TreemapLayout {
  /** Visible sections, then leaves. */
  boxes: TreemapBox[]
  /** Shown labels and values, in document order. */
  texts: TreemapText[]
  /** viewBox width and height. */
  size?: { width: number; height: number }
}

/** Each figure is the share of agreeing items, 0..1, or null with nothing to compare. */
export interface TreemapAgreement {
  boxes: number | null
  texts: number | null
  /** Whether the drawing size agrees (1 or 0). */
  frame: number | null
  cells: number
}

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

/** Read the cells, texts and size from a treemap SVG; both renderers share the class names. */
export function parseTreemapSvg(svg: string): TreemapLayout {
  const vb = /viewBox="([^"]*)"/.exec(svg)?.[1]
  const [vx = 0, vy = 0, vw, vh] = vb ? nums(vb) : []
  // Mermaid puts the tree in `translate(0, titleHeight)` inside the viewBox's
  // own coordinates; this renderer wraps everything in an offset group instead.
  const container = /<g[^>]*class="treemapContainer"[^>]*>/.exec(svg)?.[0] ?? ''
  const [, cy = 0] = nums(/translate\(([^)]*)\)/.exec(container)?.[1] ?? '')
  const outer =
    /<g transform="translate\(([^)]*)\)">\s*(?:<text class="treemapTitle|<g class="treemapContainer)/.exec(
      svg,
    )
  const [ox = -vx, oy = -vy] = outer ? nums(outer[1]!) : []
  const base = outer ? { x: ox, y: oy } : { x: -vx, y: -vy }

  const sections: TreemapBox[] = []
  for (const m of svg.matchAll(
    /<g class="treemapSection"[^>]*transform="translate\(([^)]*)\)"[^>]*>([\s\S]*?)<\/g>/g,
  )) {
    const rects = [...m[2]!.matchAll(/<rect([^>]*)>/g)].map((r) => r[1]!)
    const body = rects.find(
      (r) =>
        /class="treemapSection\b[^"]*section|class="treemapSection[ "]/.test(
          r,
        ) && !/Header/.test(r),
    )
    if (!body || /display:\s*none/.test(body)) continue
    const [x = 0, y = 0] = nums(m[1]!)
    sections.push({
      x: x + base.x,
      y: y + cy + base.y,
      width: Number(attr(body, 'width')),
      height: Number(attr(body, 'height')),
    })
  }
  const leaves: TreemapBox[] = []
  for (const m of svg.matchAll(
    /<g class="treemapNode treemapLeafGroup[^"]*"[^>]*transform="translate\(([^)]*)\)"[^>]*>\s*<rect([^>]*)>/g,
  )) {
    const [x = 0, y = 0] = nums(m[1]!)
    leaves.push({
      x: x + base.x,
      y: y + cy + base.y,
      width: Number(attr(m[2]!, 'width')),
      height: Number(attr(m[2]!, 'height')),
    })
  }

  const texts: TreemapText[] = []
  for (const m of svg.matchAll(
    /<text([^>]*class="(treemap(?:Label|Value|SectionLabel|SectionValue))"[^>]*)>([\s\S]*?)<\/text>/g,
  )) {
    const tag = m[1]!
    if (/display:\s*none/.test(tag)) continue
    const text = unescape(m[3]!).trim()
    if (text === '') continue
    const size =
      /font-size:\s*([\d.]+)px/.exec(attr(tag, 'style') ?? '')?.[1] ??
      attr(tag, 'font-size')
    texts.push({
      kind: m[2]!,
      text,
      ...(size !== undefined && { size: Number(size) }),
    })
  }
  return {
    boxes: [...sections, ...leaves],
    texts,
    size:
      vw !== undefined && vh !== undefined
        ? { width: vw, height: vh }
        : undefined,
  }
}

const near = (a: number, b: number): boolean => Math.abs(a - b) <= TOLERANCE

const share = (ok: number, n: number): number | null =>
  n === 0 ? null : ok / n

export function treemapAgreement(
  official: TreemapLayout,
  ours: TreemapLayout,
): TreemapAgreement {
  let boxes = 0
  for (const [i, o] of official.boxes.entries()) {
    const t = ours.boxes[i]
    if (
      t &&
      near(o.x, t.x) &&
      near(o.y, t.y) &&
      near(o.width, t.width) &&
      near(o.height, t.height)
    )
      boxes++
  }
  let texts = 0
  for (const [i, o] of official.texts.entries()) {
    const t = ours.texts[i]
    if (t && o.kind === t.kind && o.text === t.text && o.size === t.size)
      texts++
  }
  const frameOk =
    official.size !== undefined &&
    ours.size !== undefined &&
    near(official.size.width, ours.size.width) &&
    near(official.size.height, ours.size.height)
  return {
    boxes: share(boxes, Math.max(official.boxes.length, ours.boxes.length)),
    texts: share(texts, Math.max(official.texts.length, ours.texts.length)),
    frame: frameOk ? 1 : 0,
    cells: official.boxes.length,
  }
}

/** Lowest figure of a sample, or null when it has none. */
export function worstTreemap(a: TreemapAgreement): number | null {
  const v = [a.boxes, a.texts, a.frame].filter((x): x is number => x !== null)
  return v.length > 0 ? Math.min(...v) : null
}

/**
 * Floor for every sample's lowest figure. Boxes and the frame agree exactly;
 * the 5% is for a label fitted a pixel off (text metrics, not the layout).
 */
export const TREEMAP_FLOOR = 0.95

/** Samples under the floor; empty when within it. `errored` samples count as breaches. */
export function treemapBreaches(
  results: Record<string, TreemapAgreement>,
  errored: string[] = [],
): string[] {
  const out = errored.map((t) => `${t} (error)`)
  for (const [title, r] of Object.entries(results)) {
    const low = worstTreemap(r)
    if (low !== null && low + 1e-9 < TREEMAP_FLOOR) {
      out.push(`${title} (${Math.round(low * 100)}% < ${TREEMAP_FLOOR * 100}%)`)
    }
  }
  return out
}
