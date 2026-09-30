// ============================================================================
// ASCII renderer — C4 diagrams
//
// A dedicated C4 renderer (it does not lower to the flowchart model):
//
//   1. Rank: elements get a row from their relationships (`Rel_D`/`Rel_U`
//      reverse or keep the arrow direction as a layering constraint;
//      `Rel_R`/`Rel_L` pull the two elements into one row, left/right in
//      that order).
//   2. Place: each boundary is a container that stacks its own rows, so
//      boundaries nest and each is a bordered block sized to its contents.
//   3. Draw: persons get a stick-figure glyph, databases a drum, queues
//      parenthesised ends, external elements a dashed border, boundaries a
//      dashed rounded frame with a title.
//   4. Route: every relationship is an orthogonal path found by A* over the
//      character grid, avoiding element boxes; labels (name, then the
//      `[technology]` line) are placed beside the longest free segment.
//
// The layout is always top-to-bottom (`BT` flips the rows); `LR`/`RL` are
// laid out top-to-bottom too.
// ============================================================================

import { parseC4Diagram } from '@zombie-mermaid/mermaid-parser'
import type {
  C4Boundary,
  C4Diagram,
  C4Element,
  C4Relationship,
} from '@zombie-mermaid/mermaid-parser'
import {
  c4BoundaryTypeLine,
  c4Placement,
  c4RelLabelLines,
  c4TypeLine,
  wrapC4Text,
} from '@zombie-mermaid/mermaid-parser'
import { splitStatements, withDirectionOverride } from '@zombie-mermaid/core'
import type { AsciiConfig, AsciiTheme, CharRole, ColorMode } from './types.ts'
import { DEFAULT_PADDING_X, DEFAULT_PADDING_Y, paddingOffset } from './types.ts'
import { mkCanvas, mkRoleCanvas, canvasToString, write } from './canvas.ts'
import { displayWidth, toDisplayCells } from './display-width.ts'
import type { FlowchartAsciiExtras } from './flowchart.ts'

const WRAP = 28
const MARGIN = 2

interface Box {
  x: number
  y: number
  w: number
  h: number
}

interface ElNode {
  kind: 'el'
  el: C4Element
  lines: string[]
  glyph: boolean
  order: number
  rank: number
  box: Box
}

interface BNode {
  kind: 'b'
  b: C4Boundary
  rows: Item[][]
  headerH: number
  order: number
  rank: number
  box: Box
}

type Item = ElNode | BNode

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

/**
 * Row per element. Horizontal hints merge elements into one group; every
 * other relationship is an edge `placement.source -> placement.target`
 * between groups. Back edges found by DFS are dropped, then rows are the
 * longest path from any group with no incoming edge.
 */
export function rankElements(
  aliases: string[],
  rels: C4Relationship[],
): Map<string, number> {
  const parent = new Map<string, string>(aliases.map((a) => [a, a]))
  const find = (a: string): string => {
    let r = a
    while (parent.get(r) !== r) r = parent.get(r)!
    return r
  }
  const known = new Set(aliases)
  for (const rel of rels) {
    const p = c4Placement(rel)
    if (p.axis === 'horizontal' && known.has(p.source) && known.has(p.target)) {
      const a = find(p.source)
      const b = find(p.target)
      if (a !== b) parent.set(b, a)
    }
  }
  const out = new Map<string, Set<string>>()
  for (const a of aliases) out.set(find(a), out.get(find(a)) ?? new Set())
  for (const rel of rels) {
    const p = c4Placement(rel)
    if (p.axis === 'horizontal') continue
    if (!known.has(p.source) || !known.has(p.target)) continue
    const s = find(p.source)
    const t = find(p.target)
    if (s !== t) out.get(s)!.add(t)
  }
  // Drop back edges (DFS in declaration order) so cycles can't loop.
  const state = new Map<string, 0 | 1 | 2>()
  const dag = new Map<string, string[]>()
  const visit = (g: string) => {
    state.set(g, 1)
    const kept: string[] = []
    for (const t of out.get(g) ?? []) {
      const st = state.get(t) ?? 0
      if (st === 1) continue
      kept.push(t)
      if (st === 0) visit(t)
    }
    dag.set(g, kept)
    state.set(g, 2)
  }
  for (const g of out.keys()) if (!state.has(g)) visit(g)
  const groupRank = new Map<string, number>()
  const rankOf = (g: string): number => {
    const cached = groupRank.get(g)
    if (cached !== undefined) return cached
    groupRank.set(g, 0)
    let r = 0
    for (const [s, ts] of dag) {
      if (ts.includes(g)) r = Math.max(r, rankOf(s) + 1)
    }
    groupRank.set(g, r)
    return r
  }
  const ranks = new Map<string, number>()
  for (const a of aliases) ranks.set(a, rankOf(find(a)))
  return ranks
}

// ---------------------------------------------------------------------------
// Measuring
// ---------------------------------------------------------------------------

const PERSON_GLYPH = [' o ', '/|\\', '/ \\']

function elementLines(el: C4Element): { lines: string[]; glyph: boolean } {
  const lines: string[] = []
  if (el.kind === 'person') lines.push(...PERSON_GLYPH)
  lines.push(...wrapC4Text(el.label, WRAP), c4TypeLine(el))
  if (el.description) lines.push('', ...wrapC4Text(el.description, WRAP))
  return { lines, glyph: el.kind === 'person' }
}

function measureElement(el: C4Element, order: number): ElNode {
  const { lines, glyph } = elementLines(el)
  const inner = Math.max(...lines.map(displayWidth))
  const extra = el.shape === 'db' ? 2 : 0
  return {
    kind: 'el',
    el,
    lines,
    glyph,
    order,
    rank: 0,
    box: {
      x: 0,
      y: 0,
      w: Math.max(14, inner + 4),
      h: lines.length + 2 + extra,
    },
  }
}

// ---------------------------------------------------------------------------
// The renderer
// ---------------------------------------------------------------------------

export function renderC4Ascii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
  extras: FlowchartAsciiExtras = {},
): string {
  const diagram = withDirectionOverride(
    parseC4Diagram(splitStatements(text)),
    extras.direction,
  )
  if (diagram.elements.length === 0 && diagram.boundaries.length === 0) {
    return ''
  }
  const useAscii = config.useAscii
  const hGap = paddingOffset(config.paddingX, DEFAULT_PADDING_X, 6, 4)
  const vGap0 = paddingOffset(config.paddingY, DEFAULT_PADDING_Y, 4, 3)
  const twoLineLabels = diagram.relationships.some(
    (r) => c4RelLabelLines(r).length > 1,
  )
  const vGap = vGap0 + (twoLineLabels ? 1 : 0)

  // -- Items -------------------------------------------------------------
  const elNodes = new Map<string, ElNode>()
  for (const [i, el] of diagram.elements.entries()) {
    elNodes.set(el.alias, measureElement(el, i))
  }
  // Elements and empty boundaries (drawn as plain boxes) are rankable;
  // a populated boundary takes the rank of its topmost content.
  const leafAliases = [
    ...diagram.elements.map((e) => e.alias),
    ...emptyBoundaryAliases(diagram.boundaries),
  ]
  const ranks = rankElements(leafAliases, diagram.relationships)
  for (const [alias, node] of elNodes) node.rank = ranks.get(alias) ?? 0

  const bNodes = new Map<string, BNode>()
  const inBoundary = new Set<string>()
  const buildBoundary = (b: C4Boundary): Item => {
    const items: Item[] = []
    for (const a of b.elementAliases) {
      inBoundary.add(a)
      items.push(elNodes.get(a)!)
    }
    for (const c of b.children) items.push(buildBoundary(c))
    const typeLine = c4BoundaryTypeLine(b)
    const headerH = typeLine ? 2 : 1
    if (items.length === 0) {
      // Empty boundary: a plain labelled box.
      const lines = [...wrapC4Text(b.label, WRAP)]
      if (typeLine) lines.push(typeLine)
      const node: BNode = {
        kind: 'b',
        b,
        rows: [],
        headerH,
        order: Number.MAX_SAFE_INTEGER,
        rank: ranks.get(b.alias) ?? 0,
        box: {
          x: 0,
          y: 0,
          w: Math.max(14, Math.max(...lines.map(displayWidth)) + 4),
          h: lines.length + 2,
        },
      }
      bNodes.set(b.alias, node)
      return node
    }
    const node: BNode = {
      kind: 'b',
      b,
      rows: [],
      headerH,
      order: 0,
      rank: 0,
      box: { x: 0, y: 0, w: 0, h: 0 },
    }
    node.rows = layoutRows(items, diagram)
    // BT flips every level, not just the root, or a boundary's contents
    // would still flow downward inside an upward diagram.
    if (diagram.direction === 'BT') node.rows.reverse()
    bNodes.set(b.alias, node)
    const flat = node.rows.flat()
    node.order = Math.min(...flat.map((i) => i.order))
    node.rank = Math.min(...flat.map((i) => i.rank))
    // Sized below, once children are (children were sized on creation).
    sizeBoundary(node, hGap, vGap)
    return node
  }
  const topBoundaries = diagram.boundaries.map(buildBoundary)
  const rootItems: Item[] = [
    ...diagram.elements
      .filter((e) => !inBoundary.has(e.alias))
      .map((e) => elNodes.get(e.alias)!),
    ...topBoundaries,
  ]
  const rootRows = layoutRows(rootItems, diagram)
  if (diagram.direction === 'BT') rootRows.reverse()

  // -- Place -------------------------------------------------------------
  const titleRows = diagram.title ? 2 : 0
  const placeRows = (rows: Item[][], x0: number, y0: number, width: number) => {
    let y = y0
    for (const row of rows) {
      const gaps = rowGaps(row, diagram, hGap)
      const rowW = row.reduce((s, i) => s + i.box.w, 0) + sum(gaps)
      let x = x0 + Math.floor((width - rowW) / 2)
      const rowH = Math.max(...row.map((i) => i.box.h))
      row.forEach((item, k) => {
        placeItem(item, x, y + Math.floor((rowH - item.box.h) / 2))
        x += item.box.w + (gaps[k] ?? 0)
      })
      y += rowH + vGap
    }
  }
  const placeItem = (item: Item, x: number, y: number) => {
    item.box.x = x
    item.box.y = y
    if (item.kind === 'b' && item.rows.length > 0) {
      placeRows(item.rows, x + 2, y + item.headerH + 2, item.box.w - 4)
    }
  }
  const rootW = Math.max(
    ...rootRows.map(
      (r) =>
        r.reduce((s, i) => s + i.box.w, 0) + sum(rowGaps(r, diagram, hGap)),
    ),
  )
  placeRows(rootRows, MARGIN, MARGIN + titleRows, rootW)

  // -- Canvas ------------------------------------------------------------
  let maxX = 0
  let maxY = 0
  const allBoxes: Box[] = [...elNodes.values(), ...bNodes.values()].map(
    (n) => n.box,
  )
  for (const b of allBoxes) {
    maxX = Math.max(maxX, b.x + b.w)
    maxY = Math.max(maxY, b.y + b.h)
  }
  const width = maxX + MARGIN + 1
  const height = maxY + MARGIN + 1
  const canvas = mkCanvas(width, height)
  const roles = mkRoleCanvas(width, height)
  const put = (x: number, y: number, ch: string, role: CharRole) =>
    write(canvas, x, y, ch, { role, roleCanvas: roles })
  const putText = (x: number, y: number, s: string, role: CharRole) => {
    let cx = x
    for (const cell of toDisplayCells(s)) {
      put(cx, y, cell, role)
      cx++
    }
  }
  const borders: number[][] = Array.from({ length: width + 1 }, () =>
    new Array<number>(height + 1).fill(0),
  )
  const blocked: boolean[][] = Array.from({ length: width + 1 }, () =>
    new Array<boolean>(height + 1).fill(false),
  )
  const block = (b: Box) => {
    for (let x = b.x; x < b.x + b.w; x++) {
      for (let y = b.y; y < b.y + b.h; y++) blocked[x]![y] = true
    }
  }

  if (diagram.title) {
    const tw = displayWidth(diagram.title)
    putText(
      Math.max(0, Math.floor((width - tw) / 2)),
      MARGIN - 1,
      diagram.title,
      'text',
    )
    for (let x = 0; x < width; x++) blocked[x]![MARGIN - 1] = true
  }

  // Boundaries, outermost first.
  const drawBoundary = (n: BNode) => {
    const { x, y, w, h } = n.box
    const H = useAscii ? '-' : '╌'
    const V = useAscii ? ':' : '╎'
    const [tl, tr, bl, br] = useAscii
      ? ['+', '+', '+', '+']
      : ['╭', '╮', '╰', '╯']
    for (let i = 0; i < w; i++) {
      borders[x + i]![y]! |= BORDER_H
      borders[x + i]![y + h - 1]! |= BORDER_H
    }
    for (let j = 0; j < h; j++) {
      borders[x]![y + j]! |= BORDER_V
      borders[x + w - 1]![y + j]! |= BORDER_V
    }
    for (let i = 1; i < w - 1; i++) {
      put(x + i, y, H, 'border')
      put(x + i, y + h - 1, H, 'border')
    }
    for (let j = 1; j < h - 1; j++) {
      put(x, y + j, V, 'border')
      put(x + w - 1, y + j, V, 'border')
    }
    put(x, y, tl, 'border')
    put(x + w - 1, y, tr, 'border')
    put(x, y + h - 1, bl, 'border')
    put(x + w - 1, y + h - 1, br, 'border')
    if (n.rows.length > 0) {
      putText(x + 2, y + 1, n.b.label, 'text')
      const t = c4BoundaryTypeLine(n.b)
      if (t) putText(x + 2, y + 2, t, 'text')
      // Header text is not routable.
      const headW = Math.max(displayWidth(n.b.label), displayWidth(t ?? '')) + 2
      for (let i = 1; i <= headW && x + i < x + w - 1; i++) {
        for (let j = 1; j <= n.headerH; j++) blocked[x + i]![y + j] = true
      }
    } else {
      const lines = [...wrapC4Text(n.b.label, WRAP)]
      const t = c4BoundaryTypeLine(n.b)
      if (t) lines.push(t)
      lines.forEach((l, k) =>
        putText(
          x + Math.floor((w - displayWidth(l)) / 2),
          y + 1 + k,
          l,
          'text',
        ),
      )
      block(n.box)
    }
  }
  const drawBoundaries = (items: Item[]) => {
    for (const it of items) {
      if (it.kind !== 'b') continue
      drawBoundary(it)
      drawBoundaries(it.rows.flat())
    }
  }
  drawBoundaries(rootRows.flat())

  const drawElement = (n: ElNode) => {
    const { x, y, w, h } = n.box
    const el = n.el
    const dashed = el.external
    const H = useAscii ? (dashed ? '.' : '-') : dashed ? '┄' : '─'
    const V = useAscii ? (dashed ? ':' : '|') : dashed ? '┆' : '│'
    const rounded = el.kind === 'person' || el.shape !== 'default'
    const [tl, tr, bl, br] = useAscii
      ? ['+', '+', '+', '+']
      : rounded
        ? ['╭', '╮', '╰', '╯']
        : ['┌', '┐', '└', '┘']
    for (let i = 1; i < w - 1; i++) {
      put(x + i, y, H, 'border')
      put(x + i, y + h - 1, H, 'border')
    }
    const leftV = el.shape === 'queue' ? '(' : V
    const rightV = el.shape === 'queue' ? ')' : V
    for (let j = 1; j < h - 1; j++) {
      put(x, y + j, leftV, 'border')
      put(x + w - 1, y + j, rightV, 'border')
    }
    put(x, y, tl, 'border')
    put(x + w - 1, y, tr, 'border')
    put(x, y + h - 1, bl, 'border')
    put(x + w - 1, y + h - 1, br, 'border')
    let textTop = y + 1
    if (el.shape === 'db') {
      const capL = useAscii ? '+' : '├'
      const capR = useAscii ? '+' : '┤'
      for (const cy of [y + 1, y + h - 2]) {
        put(x, cy, capL, 'junction')
        put(x + w - 1, cy, capR, 'junction')
        for (let i = 1; i < w - 1; i++) put(x + i, cy, H, 'border')
      }
      textTop = y + 2
    }
    n.lines.forEach((line, k) => {
      const isGlyph = n.glyph && k < PERSON_GLYPH.length
      const lw = displayWidth(line)
      putText(
        x + Math.floor((w - lw) / 2),
        textTop + k,
        line,
        isGlyph ? 'border' : 'text',
      )
    })
    block(n.box)
  }
  for (const n of elNodes.values()) drawElement(n)

  // -- Route -------------------------------------------------------------
  const rectOf = (alias: string): { box: Box; boundary: boolean } => {
    const e = elNodes.get(alias)
    if (e) return { box: e.box, boundary: false }
    return { box: bNodes.get(alias)!.box, boundary: true }
  }
  const masks: number[][] = Array.from({ length: width + 1 }, () =>
    new Array<number>(height + 1).fill(0),
  )
  const arrows: Map<string, string> = new Map()
  interface Routed {
    rel: C4Relationship
    path: [number, number][]
  }
  const routed: Routed[] = []
  for (const rel of diagram.relationships) {
    if (rel.from === rel.to) continue
    const a = rectOf(rel.from)
    const b = rectOf(rel.to)
    const extraBlocked: Box[] = []
    if (a.boundary && bNodes.get(rel.from)!.rows.length > 0)
      extraBlocked.push(a.box)
    if (b.boundary && bNodes.get(rel.to)!.rows.length > 0)
      extraBlocked.push(b.box)
    const path = findPath(
      a.box,
      b.box,
      { width, height, blocked, masks, arrows, borders },
      extraBlocked,
    )
    if (!path) continue
    routed.push({ rel, path })
    stamp(path, masks, a.box, b.box)
    const last = path[path.length - 1]!
    const first = path[0]!
    if (!rel.reversed || rel.bidirectional) {
      arrows.set(
        `${last[0]},${last[1]}`,
        arrowChar(towardBox(last, b.box), useAscii),
      )
    }
    if (rel.bidirectional || rel.reversed) {
      arrows.set(
        `${first[0]},${first[1]}`,
        arrowChar(towardBox(first, a.box), useAscii),
      )
    }
  }
  for (let x = 0; x <= width; x++) {
    for (let y = 0; y <= height; y++) {
      const m = masks[x]![y]!
      if (m === 0) continue
      const arrow = arrows.get(`${x},${y}`)
      if (arrow) put(x, y, arrow, 'arrow')
      else put(x, y, lineChar(m, useAscii), isCorner(m) ? 'corner' : 'line')
    }
  }
  for (const [key, ch] of arrows) {
    const [x, y] = key.split(',').map(Number) as [number, number]
    put(x, y, ch, 'arrow')
  }

  // -- Labels ------------------------------------------------------------
  const isFree = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x <= width &&
    y <= height &&
    canvas[x]![y] === ' ' &&
    !blocked[x]![y]
  const canOverwrite = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x <= width &&
    y <= height &&
    !blocked[x]![y] &&
    !arrows.has(`${x},${y}`) &&
    (canvas[x]![y] === ' ' || masks[x]![y]! !== 0)
  for (const { rel, path } of routed) {
    const lines = c4RelLabelLines(rel)
    if (lines.length === 0) continue
    // A label wider than any free spot beside its route is wrapped narrower
    // before giving up, so a relationship never loses its text.
    const widest = Math.max(...lines.map(displayWidth))
    const attempts = [lines]
    for (const w of [18, 12, 8]) {
      if (widest > w) {
        attempts.push(
          lines.flatMap((l, i) => (i === 0 ? wrapC4Text(l, w) : [l])),
        )
      }
    }
    for (const attempt of attempts) {
      if (placeLabel(attempt, path, isFree, canOverwrite, putText)) break
    }
  }

  return canvasToString(canvas, { roleCanvas: roles, colorMode, theme })
}

// ---------------------------------------------------------------------------
// Row layout helpers
// ---------------------------------------------------------------------------

function emptyBoundaryAliases(boundaries: C4Boundary[]): string[] {
  return boundaries.flatMap((b) =>
    b.elementAliases.length === 0 && b.children.length === 0
      ? [b.alias]
      : emptyBoundaryAliases(b.children),
  )
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)

/** Widest label of a horizontal-hint relationship joining these two items. */
function pairLabelWidth(a: Item, b: Item, diagram: C4Diagram): number {
  const has = (item: Item, alias: string) =>
    item.kind === 'el' ? item.el.alias === alias : item.b.alias === alias
  let w = 0
  for (const rel of diagram.relationships) {
    const p = c4Placement(rel)
    if (p.axis !== 'horizontal') continue
    if (
      (has(a, p.source) && has(b, p.target)) ||
      (has(b, p.source) && has(a, p.target))
    ) {
      w = Math.max(w, ...c4RelLabelLines(rel).map(displayWidth))
    }
  }
  return w
}

function rowGaps(row: Item[], diagram: C4Diagram, hGap: number): number[] {
  const gaps: number[] = []
  for (let i = 0; i < row.length - 1; i++) {
    const lw = pairLabelWidth(row[i]!, row[i + 1]!, diagram)
    gaps.push(Math.max(hGap, lw > 0 ? lw + 4 : 0))
  }
  return gaps
}

/**
 * Group a container's items into rows by rank, ordered by declaration, with
 * horizontal hints ("a left of b") moving `a` ahead of `b` in the row.
 */
function layoutRows(items: Item[], diagram: C4Diagram): Item[][] {
  const byRank = new Map<number, Item[]>()
  for (const it of items) {
    byRank.set(it.rank, [...(byRank.get(it.rank) ?? []), it])
  }
  const rows = [...byRank.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => row.sort((a, b) => a.order - b.order))
  const idOf = (i: Item) => (i.kind === 'el' ? i.el.alias : i.b.alias)
  for (const row of rows) {
    for (let pass = 0; pass < row.length; pass++) {
      let moved = false
      for (const rel of diagram.relationships) {
        const p = c4Placement(rel)
        if (p.axis !== 'horizontal') continue
        const ids = row.map(idOf)
        const bi = ids.indexOf(p.source)
        const ai = ids.indexOf(p.target)
        if (bi < 0 || ai < 0 || bi < ai) continue
        const [node] = row.splice(bi, 1)
        row.splice(ai, 0, node!)
        moved = true
      }
      if (!moved) break
    }
  }
  return rows
}

function sizeBoundary(n: BNode, hGap: number, vGap: number): void {
  let w = 0
  // Top border, header rows, then one free row for edges to enter through.
  let h = n.headerH + 2
  for (const row of n.rows) {
    const rw = sum(row.map((i) => i.box.w)) + (row.length - 1) * hGap
    w = Math.max(w, rw)
    h += Math.max(...row.map((i) => i.box.h)) + vGap
  }
  const label = Math.max(
    displayWidth(n.b.label),
    displayWidth(c4BoundaryTypeLine(n.b) ?? ''),
  )
  n.box.w = Math.max(w, label) + 4
  // One free row below the last row, then the bottom border.
  n.box.h = h - vGap + 2
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

const U = 1
const D = 2
const L = 4
const R = 8
// Boundary frame cell kinds, so a route can be kept off a frame it would
// otherwise run along and hide.
const BORDER_H = 1
const BORDER_V = 2

interface Grid {
  width: number
  height: number
  blocked: boolean[][]
  masks: number[][]
  arrows: Map<string, string>
  /** Boundary frame cells: `BORDER_H` / `BORDER_V` per cell. */
  borders: number[][]
}

function towardBox(cell: [number, number], box: Box): number {
  const [x, y] = cell
  if (y < box.y) return D
  if (y >= box.y + box.h) return U
  if (x < box.x) return R
  return L
}

function arrowChar(dir: number, ascii: boolean): string {
  if (dir === D) return ascii ? 'v' : '▼'
  if (dir === U) return ascii ? '^' : '▲'
  if (dir === R) return ascii ? '>' : '►'
  return ascii ? '<' : '◄'
}

const UNICODE_LINES: Record<number, string> = {
  [U]: '│',
  [D]: '│',
  [U | D]: '│',
  [L]: '─',
  [R]: '─',
  [L | R]: '─',
  [D | R]: '┌',
  [D | L]: '┐',
  [U | R]: '└',
  [U | L]: '┘',
  [U | D | R]: '├',
  [U | D | L]: '┤',
  [L | R | D]: '┬',
  [L | R | U]: '┴',
  [U | D | L | R]: '┼',
}

function lineChar(mask: number, ascii: boolean): string {
  const uni = UNICODE_LINES[mask] ?? '┼'
  if (!ascii) return uni
  if (uni === '│') return '|'
  if (uni === '─') return '-'
  return '+'
}

function isCorner(mask: number): boolean {
  return (
    mask === (D | R) || mask === (D | L) || mask === (U | R) || mask === (U | L)
  )
}

/** Record a path's connections, including the stub toward each end box. */
function stamp(
  path: [number, number][],
  masks: number[][],
  fromBox: Box,
  toBox: Box,
): void {
  const dirBetween = (a: [number, number], b: [number, number]) =>
    b[0] > a[0] ? R : b[0] < a[0] ? L : b[1] > a[1] ? D : U
  const opposite = (d: number) => (d === U ? D : d === D ? U : d === L ? R : L)
  for (let i = 0; i < path.length; i++) {
    const [x, y] = path[i]!
    if (i > 0) masks[x]![y]! |= opposite(dirBetween(path[i - 1]!, path[i]!))
    if (i < path.length - 1) masks[x]![y]! |= dirBetween(path[i]!, path[i + 1]!)
  }
  // The end cells sit one step outside their boxes; connect them to the box
  // edge so a route that turns right away doesn't look detached.
  const first = path[0]!
  const last = path[path.length - 1]!
  masks[first[0]]![first[1]]! |= towardBox(first, fromBox)
  masks[last[0]]![last[1]]! |= towardBox(last, toBox)
}

interface Node {
  x: number
  y: number
  dir: number
  g: number
  f: number
  parent: Node | undefined
}

function ports(
  box: Box,
  other: Box,
  grid: Grid,
): { cell: [number, number]; cost: number }[] {
  const out: { cell: [number, number]; cost: number }[] = []
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  const ox = other.x + other.w / 2
  const oy = other.y + other.h / 2
  const overlapY = other.y < box.y + box.h && box.y < other.y + other.h
  const pref = new Set<number>()
  if (overlapY) pref.add(ox > cx ? R : L)
  else pref.add(oy > cy ? D : U)
  const sideCost = (side: number) =>
    pref.has(side)
      ? 0
      : (side === D && pref.has(U)) ||
          (side === U && pref.has(D)) ||
          (side === L && pref.has(R)) ||
          (side === R && pref.has(L))
        ? 14
        : 7
  const add = (x: number, y: number, side: number, along: number) => {
    if (x < 0 || y < 0 || x > grid.width || y > grid.height) return
    if (grid.blocked[x]![y]) return
    out.push({ cell: [x, y], cost: sideCost(side) + Math.abs(along) * 0.2 })
  }
  for (let x = box.x + 1; x < box.x + box.w - 1; x++) {
    add(x, box.y - 1, U, x - cx)
    add(x, box.y + box.h, D, x - cx)
  }
  for (let y = box.y + 1; y < box.y + box.h - 1; y++) {
    add(box.x - 1, y, L, y - cy)
    add(box.x + box.w, y, R, y - cy)
  }
  return out
}

function findPath(
  from: Box,
  to: Box,
  grid: Grid,
  extraBlocked: Box[],
): [number, number][] | undefined {
  const inExtra = (x: number, y: number) =>
    extraBlocked.some(
      (b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h,
    )
  const starts = ports(from, to, grid).filter((p) => !inExtra(...p.cell))
  const goals = new Map<string, number>()
  for (const p of ports(to, from, grid)) {
    if (!inExtra(...p.cell)) goals.set(`${p.cell[0]},${p.cell[1]}`, p.cost)
  }
  if (starts.length === 0 || goals.size === 0) return undefined

  const heuristic = (x: number, y: number) => {
    const dx =
      x < to.x ? to.x - x : x >= to.x + to.w ? x - (to.x + to.w - 1) : 0
    const dy =
      y < to.y ? to.y - y : y >= to.y + to.h ? y - (to.y + to.h - 1) : 0
    return dx + dy
  }
  const open: Node[] = []
  const best = new Map<string, number>()
  for (const s of starts) {
    const [x, y] = s.cell
    open.push({
      x,
      y,
      dir: 0,
      g: s.cost,
      f: s.cost + heuristic(x, y),
      parent: undefined,
    })
    best.set(`${x},${y},0`, s.cost)
  }
  const dirs: [number, number, number][] = [
    [0, -1, U],
    [0, 1, D],
    [-1, 0, L],
    [1, 0, R],
  ]
  let guard = 0
  while (open.length > 0 && guard++ < 200000) {
    let bi = 0
    for (let i = 1; i < open.length; i++) if (open[i]!.f < open[bi]!.f) bi = i
    const cur = open.splice(bi, 1)[0]!
    const gk = `${cur.x},${cur.y}`
    const goalCost = goals.get(gk)
    if (goalCost !== undefined) {
      const path: [number, number][] = []
      for (let n: Node | undefined = cur; n; n = n.parent) path.push([n.x, n.y])
      return path.reverse()
    }
    for (const [dx, dy, d] of dirs) {
      const nx = cur.x + dx
      const ny = cur.y + dy
      if (nx < 0 || ny < 0 || nx > grid.width || ny > grid.height) continue
      const isGoal = goals.has(`${nx},${ny}`)
      if (grid.blocked[nx]![ny] && !isGoal) continue
      if (inExtra(nx, ny)) continue
      if (grid.arrows.has(`${nx},${ny}`)) continue
      let step = 1
      if (cur.dir !== 0 && cur.dir !== d) step += 2
      const onBorder = grid.borders[nx]![ny]!
      if (onBorder !== 0) {
        const horizontal = d === L || d === R
        if (
          horizontal ? (onBorder & BORDER_H) !== 0 : (onBorder & BORDER_V) !== 0
        )
          step += 12
      }
      const m = grid.masks[nx]![ny]!
      if (m !== 0) {
        const horizontal = d === L || d === R
        const existingH = (m & (L | R)) !== 0
        const existingV = (m & (U | D)) !== 0
        step += (horizontal && existingH) || (!horizontal && existingV) ? 8 : 3
      }
      const g = cur.g + step + (isGoal ? (goals.get(`${nx},${ny}`) ?? 0) : 0)
      const key = `${nx},${ny},${d}`
      if ((best.get(key) ?? Infinity) <= g) continue
      best.set(key, g)
      open.push({
        x: nx,
        y: ny,
        dir: d,
        g,
        f: g + heuristic(nx, ny),
        parent: cur,
      })
    }
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

interface Segment {
  horizontal: boolean
  x0: number
  y0: number
  len: number
}

function segments(path: [number, number][]): Segment[] {
  const segs: Segment[] = []
  let i = 0
  while (i < path.length - 1) {
    const horizontal = path[i + 1]![1] === path[i]![1]
    let j = i + 1
    while (
      j < path.length - 1 &&
      (path[j + 1]![1] === path[j]![1]) === horizontal
    ) {
      j++
    }
    const [x0, y0] = path[i]!
    const [x1, y1] = path[j]!
    segs.push({
      horizontal,
      x0: Math.min(x0, x1),
      y0: Math.min(y0, y1),
      len: Math.abs(x1 - x0) + Math.abs(y1 - y0) + 1,
    })
    i = j
  }
  return segs
}

function placeLabel(
  lines: string[],
  path: [number, number][],
  isFree: (x: number, y: number) => boolean,
  canOverwrite: (x: number, y: number) => boolean,
  putText: (x: number, y: number, s: string, role: CharRole) => void,
): boolean {
  const widths = lines.map(displayWidth)
  const fits = (cand: [number, number][]) =>
    cand.every(([x, y], k) => {
      const w = widths[k]!
      for (let i = 0; i < w; i++) if (!isFree(x + i, y)) return false
      // Keep a blank cell either side so a label never touches a line.
      return isFree(x - 1, y) && isFree(x + w, y)
    })
  const byMid = (len: number) =>
    Array.from({ length: len }, (_, i) => i).sort(
      (a, b) => Math.abs(a - len / 2) - Math.abs(b - len / 2),
    )
  for (const seg of segments(path).sort((a, b) => b.len - a.len)) {
    for (const t of byMid(seg.len)) {
      const candidates: [number, number][][] = []
      if (seg.horizontal) {
        const x = seg.x0 + t
        // Name above the line, technology below it.
        candidates.push(
          lines.map((_, k) => [
            x - Math.floor(widths[k]! / 2),
            k === 0 ? seg.y0 - 1 : seg.y0 + k,
          ]),
        )
        if (lines.length === 1) {
          candidates.push([[x - Math.floor(widths[0]! / 2), seg.y0 + 1]])
        }
      } else {
        const top = seg.y0 + t - Math.floor((lines.length - 1) / 2)
        for (const side of [1, -1]) {
          candidates.push(
            lines.map((_, k) => [
              side > 0 ? seg.x0 + 2 : seg.x0 - 1 - widths[k]!,
              top + k,
            ]),
          )
        }
      }
      for (const cand of candidates) {
        if (fits(cand)) {
          cand.forEach(([x, y], k) => putText(x, y, lines[k]!, 'text'))
          return true
        }
      }
    }
  }
  // No blank spot beside the route: sit the label on the line itself, as the
  // flowchart renderer does, replacing line cells but never a box or text.
  const overLine = (cand: [number, number][]) =>
    cand.every(([x, y], k) => {
      for (let i = 0; i < widths[k]!; i++)
        if (!canOverwrite(x + i, y)) return false
      return true
    })
  for (const seg of segments(path).sort((a, b) => b.len - a.len)) {
    for (const t of byMid(seg.len)) {
      const cand: [number, number][] = lines.map((_, k) =>
        seg.horizontal
          ? [
              seg.x0 + t - Math.floor(widths[k]! / 2),
              seg.y0 + k - (lines.length > 1 ? 1 : 0),
            ]
          : [seg.x0 - Math.floor(widths[k]! / 2), seg.y0 + t + k],
      )
      if (overLine(cand)) {
        cand.forEach(([x, y], k) => putText(x, y, lines[k]!, 'text'))
        return true
      }
    }
  }
  return false
}
