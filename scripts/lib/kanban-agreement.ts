/**
 * Kanban agreement against official mermaid.js, for scripts/kanban-oracle.ts.
 * Browser-free so it can be unit-tested.
 *
 * A kanban board is arithmetic plus line breaks, so what can regress is where each
 * column and card sits and how big it is (a card's height encodes how many lines
 * its text wraps to), the priority bars and the size of the drawing. Everything is
 * compared relative to the viewBox origin, in drawing order. Colours and fonts
 * are not compared.
 */

export interface KanbanRect {
  x: number
  y: number
  width: number
  height: number
}

export interface KanbanLayout {
  columns: KanbanRect[]
  cards: KanbanRect[]
  /** Priority bar stroke per card, `''` when the card has none, `'-'` for a bar with no stroke. */
  bars: string[]
  size: { width: number; height: number }
}

/** Each figure is the share of agreeing items, 0..1, or null with nothing to compare. */
export interface KanbanAgreement {
  columns: number | null
  cards: number | null
  bars: number | null
  /** 1 when the drawing size is within SIZE_TOLERANCE px, else 0. */
  frame: number
}

/** Pixels; Mermaid prints float sums to many digits. */
export const TOLERANCE = 0.5
/** Pixels for the drawing size (an overflowing label is measured in the browser there). */
export const SIZE_TOLERANCE = 1

const num = (s: string | undefined): number => Number(s ?? 0)
/** The value of attribute `name` in a tag (a plain scan, no dynamic regex). */
const attr = (tag: string, name: string): string | undefined => {
  const at = tag.indexOf(` ${name}="`)
  if (at === -1) return undefined
  const from = at + name.length + 3
  return tag.slice(from, tag.indexOf('"', from))
}

function rectOf(tag: string, dx: number, dy: number): KanbanRect {
  return {
    x: num(attr(tag, 'x')) + dx,
    y: num(attr(tag, 'y')) + dy,
    width: num(attr(tag, 'width')),
    height: num(attr(tag, 'height')),
  }
}

/** Read the figures out of an official mermaid render or ours. */
export function parseKanbanSvg(svg: string): KanbanLayout {
  const [vx = 0, vy = 0, vw = 0, vh = 0] = (
    /viewBox="([^"]*)"/.exec(svg)?.[1] ?? ''
  )
    .split(/\s+/)
    .map(Number)
  const layout: KanbanLayout = {
    columns: [],
    cards: [],
    bars: [],
    size: { width: vw, height: vh },
  }
  // Ours wraps everything in translate(-vx, -vy) under a 0 0 viewBox; Mermaid
  // draws in viewBox space. Either way a point is at its value plus the shift.
  const shift = /<g transform="translate\(([-\d.]+), ([-\d.]+)\)">/.exec(svg)
  const ours = shift !== null
  const [ox, oy] = ours ? [num(shift[1]), num(shift[2])] : [-vx, -vy]
  for (const m of svg.matchAll(
    /<g class="cluster[^"]*"[^>]*>\s*<rect([^>]*)>/g,
  ))
    layout.columns.push(rectOf(m[1]!, ox, oy))
  const groups = svg.split(/<g class="node[ "]/).slice(1)
  for (const g of groups) {
    const t = /transform="translate\(([-\d.]+),\s*([-\d.]+)\)"/.exec(
      g.slice(0, 200),
    )
    const [tx, ty] = ours ? [0, 0] : [num(t?.[1]), num(t?.[2])]
    const rect = /<rect[^>]*class="basic[^>]*>/.exec(g)?.[0]
    if (rect === undefined) continue
    layout.cards.push(rectOf(rect, tx + ox, ty + oy))
    const line = /<line[^>]*stroke-width="4"[^>]*>/.exec(g)?.[0]
    layout.bars.push(line === undefined ? '' : (attr(line, 'stroke') ?? '-'))
  }
  return layout
}

const near = (a: number, b: number, tol = TOLERANCE): boolean =>
  Math.abs(a - b) <= tol
const sameRect = (a: KanbanRect, b: KanbanRect): boolean =>
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

export function kanbanAgreement(
  official: KanbanLayout,
  ours: KanbanLayout,
): KanbanAgreement {
  return {
    columns: share(official.columns, ours.columns, sameRect),
    cards: share(official.cards, ours.cards, sameRect),
    bars: share(official.bars, ours.bars, (a, b) => a === b),
    frame:
      near(official.size.width, ours.size.width, SIZE_TOLERANCE) &&
      near(official.size.height, ours.size.height, SIZE_TOLERANCE)
        ? 1
        : 0,
  }
}

/** Gallery samples below 100% on any figure, for `--thresholds`. */
export function kanbanBreaches(
  results: Record<string, KanbanAgreement>,
  errored: string[],
): string[] {
  const bad = Object.entries(results)
    .filter(([, a]) => Object.values(a).some((v) => v !== null && v < 1))
    .map(([title]) => title)
  return [...bad, ...errored]
}
