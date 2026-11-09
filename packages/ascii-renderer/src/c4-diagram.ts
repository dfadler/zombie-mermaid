// ============================================================================
// ASCII renderer — C4 diagrams
//
// A dedicated C4 renderer (it does not lower to the flowchart model):
//
//   1. Rows: shapes go in rows in declaration order, as Mermaid places them
//      (c4-rows.ts); relationship directions do not move anything.
//   2. Place: each boundary is a container that stacks its own rows, so
//      boundaries nest and each is a bordered block sized to its contents.
//   3. Draw: persons get a stick-figure glyph, databases a drum, queues
//      parenthesised ends, external elements a dashed border, boundaries a
//      dashed rounded frame with a title.
//   4. Route: every relationship is an orthogonal path found by A* over the
//      character grid, avoiding element boxes; labels (name, then the
//      `[technology]` line) are placed beside the longest free segment.
//      Grid limit: mermaid 12.3.0 draws each relationship centre to centre,
//      the first as a straight `<line>` and the rest as a `Q` curve, so a line
//      between non-adjacent shapes crosses the shapes between them. A character
//      cell holds one glyph, so a route cannot cross a box and bends around it
//      instead (#2790).
//
// The direction does not change the layout, as in Mermaid.
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
  c4RelLabelLines,
  c4TypeLine,
  wrapC4Text,
} from '@zombie-mermaid/mermaid-parser'
import {
  extractInitConfig,
  splitStatements,
  withDirectionOverride,
} from '@zombie-mermaid/core'
import type { AsciiConfig, AsciiTheme, CharRole, ColorMode } from './types.ts'
import { DEFAULT_PADDING_X, DEFAULT_PADDING_Y, paddingOffset } from './types.ts'
import { mkCanvas, mkRoleCanvas, canvasToString, write } from './canvas.ts'
import { displayWidth, toDisplayCells } from './display-width.ts'
import { c4Rows } from './c4-rows.ts'
import type { C4Frame } from './c4-rows.ts'
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
  box: Box
}

interface BNode {
  kind: 'b'
  b: C4Boundary
  rows: Item[][]
  /** Rows of free space after each row but the last (see `verticalGaps`). */
  vgaps: number[]
  headerH: number
  box: Box
}

type Item = ElNode | BNode

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

function measureElement(el: C4Element): ElNode {
  const { lines, glyph } = elementLines(el)
  const inner = Math.max(...lines.map(displayWidth))
  const extra = el.shape === 'db' ? 2 : 0
  return {
    kind: 'el',
    el,
    lines,
    glyph,
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
  extras: FlowchartAsciiExtras & { accTitle?: string } = {},
): string {
  const diagram = withDirectionOverride(
    parseC4Diagram(splitStatements(text)),
    extras.direction,
  )
  diagram.layout = extractInitConfig(text.split(/\r\n?|\n/)).c4Layout
  // Mermaid 12.3.0 draws accTitle in the title slot, over any `title`.
  diagram.title = extras.accTitle?.replace(/\s+/g, ' ') || diagram.title
  if (
    diagram.elements.length === 0 &&
    diagram.boundaries.length === 0 &&
    !diagram.title
  ) {
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
  for (const el of diagram.elements) elNodes.set(el.alias, measureElement(el))
  const bNodes = new Map<string, BNode>()
  const toRows = (f: C4Frame): Item[][] => [
    ...f.shapeRows.map((r) => r.map((el) => elNodes.get(el.alias)!)),
    ...f.boundaryRows.map((r) => r.map(buildBoundary)),
  ]
  const buildBoundary = (f: C4Frame): Item => {
    const b = f.boundary!
    const rows = toRows(f)
    const typeLine = c4BoundaryTypeLine(b)
    const headerH = typeLine ? 2 : 1
    if (rows.length === 0) {
      // Empty boundary: a plain labelled box.
      const lines = [...wrapC4Text(b.label, WRAP)]
      if (typeLine) lines.push(typeLine)
      const node: BNode = {
        kind: 'b',
        b,
        rows: [],
        vgaps: [],
        headerH,
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
      vgaps: [],
      headerH,
      box: { x: 0, y: 0, w: 0, h: 0 },
    }
    node.rows = rows
    node.vgaps = verticalGaps(node.rows, diagram, vGap)
    bNodes.set(b.alias, node)
    // Sized below, once children are (children were sized on creation).
    sizeBoundary(node, diagram, hGap)
    return node
  }
  const rootRows = toRows(c4Rows(diagram))
  const rootVGaps = verticalGaps(rootRows, diagram, vGap)

  // -- Place -------------------------------------------------------------
  const titleRows = diagram.title ? 2 : 0
  const placeRows = (
    rows: Item[][],
    vgaps: number[],
    x0: number,
    y0: number,
  ) => {
    let y = y0
    for (const [ri, row] of rows.entries()) {
      const gaps = rowGaps(row, diagram, hGap)
      // Mermaid starts every row at the left and aligns shapes by their tops.
      let x = x0
      const rowH = Math.max(...row.map((i) => i.box.h))
      row.forEach((item, k) => {
        placeItem(item, x, y)
        x += item.box.w + (gaps[k] ?? 0)
      })
      y += rowH + (vgaps[ri] ?? 0)
    }
  }
  const placeItem = (item: Item, x: number, y: number) => {
    item.box.x = x
    item.box.y = y
    if (item.kind === 'b' && item.rows.length > 0) {
      placeRows(item.rows, item.vgaps, x + 2, y + item.headerH + 2)
    }
  }
  placeRows(rootRows, rootVGaps, MARGIN, MARGIN + titleRows)

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
  const width = Math.max(
    maxX + MARGIN + 1,
    // A title-only diagram has no boxes to size the canvas.
    diagram.title ? displayWidth(diagram.title) + 2 * MARGIN : 0,
  )
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
    const grid = { width, height, blocked, masks, arrows, borders }
    // An arrowhead needs a stroke running in its direction behind it, so the
    // route must meet each headed end straight on. Fall back to any route
    // rather than drop the relationship when no straight approach exists.
    const heads = {
      start: !!(rel.bidirectional || rel.reversed),
      end: !rel.reversed || rel.bidirectional,
    }
    const path = [heads, undefined].reduce<[number, number][] | undefined>(
      (found, h) => found ?? findPath(a.box, b.box, grid, extraBlocked, h),
      undefined,
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
    // first; only when no wrapping fits beside the route does it sit on the
    // line itself, which breaks that line (or a neighbour) for its width.
    const widest = Math.max(...lines.map(displayWidth))
    const attempts = [lines]
    for (const w of [18, 12, 8, 6]) {
      if (widest > w) {
        attempts.push(
          lines.flatMap((l, i) => (i === 0 ? wrapC4Text(l, w) : [l])),
        )
      }
    }
    const place = (onLine: boolean) =>
      attempts.some((a) =>
        placeLabel(a, path, isFree, canOverwrite, putText, onLine),
      )
    if (!place(false)) place(true)
  }

  return canvasToString(canvas, { roleCanvas: roles, colorMode, theme })
}

// ---------------------------------------------------------------------------
// Row layout helpers
// ---------------------------------------------------------------------------

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)

/** Widest label of a relationship joining these two (neighbouring) items. */
function pairLabelWidth(a: Item, b: Item, diagram: C4Diagram): number {
  const inA = aliasesOf(a)
  const inB = aliasesOf(b)
  let w = 0
  for (const rel of diagram.relationships) {
    if (
      (inA.has(rel.from) && inB.has(rel.to)) ||
      (inB.has(rel.from) && inA.has(rel.to))
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

function sizeBoundary(n: BNode, diagram: C4Diagram, hGap: number): void {
  let w = 0
  // Top border, header rows, then one free row for edges to enter through.
  let h = n.headerH + 2
  for (const [i, row] of n.rows.entries()) {
    const rw = sum(row.map((it) => it.box.w)) + sum(rowGaps(row, diagram, hGap))
    w = Math.max(w, rw)
    h += Math.max(...row.map((it) => it.box.h)) + (n.vgaps[i] ?? 0)
  }
  const label = Math.max(
    displayWidth(n.b.label),
    displayWidth(c4BoundaryTypeLine(n.b) ?? ''),
  )
  n.box.w = Math.max(w, label) + 4
  // One free row below the last row, then the bottom border.
  n.box.h = h + 2
}

/** Every alias an item holds: an element's own, or a boundary's and its contents'. */
function aliasesOf(item: Item, out = new Set<string>()): Set<string> {
  if (item.kind === 'el') {
    out.add(item.el.alias)
  } else {
    out.add(item.b.alias)
    for (const r of item.rows) for (const it of r) aliasesOf(it, out)
  }
  return out
}

/**
 * Rows of free space after each row (all but the last). At least `vGap`, and
 * more when labelled relationships cross the gap, so each label gets a row of
 * its own beside its route instead of being wrapped or stacked on another.
 * A relationship is counted in every gap it crosses.
 */
function verticalGaps(
  rows: Item[][],
  diagram: C4Diagram,
  vGap: number,
): number[] {
  const rowOf = new Map<string, number>()
  rows.forEach((row, i) => {
    for (const item of row) for (const a of aliasesOf(item)) rowOf.set(a, i)
  })
  const need: number[] = rows.map(() => 0)
  for (const rel of diagram.relationships) {
    const a = rowOf.get(rel.from)
    const b = rowOf.get(rel.to)
    if (a === undefined || b === undefined || a === b) continue
    const lines = c4RelLabelLines(rel).length
    if (lines === 0) continue
    // One row per label line, plus a blank row to keep it off the next, in
    // every gap the route crosses (its label may land in any of them).
    for (let g = Math.min(a, b); g < Math.max(a, b); g++) {
      need[g] = need[g]! + lines + 1
    }
  }
  return rows.slice(0, -1).map((_, i) => Math.max(vGap, need[i]! + 1))
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

function oppositeDir(d: number): number {
  return d === U ? D : d === D ? U : d === L ? R : L
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
  heads?: { start: boolean; end: boolean },
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
    if (
      goalCost !== undefined &&
      (!heads?.end || !cur.parent || cur.dir === towardBox([cur.x, cur.y], to))
    ) {
      const path: [number, number][] = []
      for (let n: Node | undefined = cur; n; n = n.parent) path.push([n.x, n.y])
      return path.reverse()
    }
    for (const [dx, dy, d] of dirs) {
      const nx = cur.x + dx
      const ny = cur.y + dy
      if (nx < 0 || ny < 0 || nx > grid.width || ny > grid.height) continue
      if (
        heads?.start &&
        !cur.parent &&
        d !== oppositeDir(towardBox([cur.x, cur.y], from))
      )
        continue
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
      // A stroke running along a box's side reads as part of its border, so
      // keep clear of a box when there is room. The goal cell is exempt: a
      // route has to meet its own box.
      if (!isGoal) {
        const [sx, sy] = d === L || d === R ? [0, 1] : [1, 0]
        for (const k of [1, -1]) {
          if (grid.blocked[nx + sx * k]?.[ny + sy * k]) step += 3
        }
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
  onLine: boolean,
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
  for (const seg of onLine
    ? []
    : segments(path).sort((a, b) => b.len - a.len)) {
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
  for (const seg of onLine
    ? segments(path).sort((a, b) => b.len - a.len)
    : []) {
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
