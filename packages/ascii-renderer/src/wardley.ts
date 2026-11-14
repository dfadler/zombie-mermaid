// ============================================================================
// ASCII renderer — Wardley maps
//
// Mermaid has no text mode for Wardley maps, so there is no reference output
// to match. The map is drawn on a 72 x 22 character grid with the same axes
// as the SVG: visibility up the left, evolution along the bottom with the
// stage names under it (the `evolution` stages and their `@` boundaries are
// honoured, the default is Genesis / Custom Built / Product / Commodity):
//
//   Tea Shop
//   Visibility
//   │          ┊            ┊             ┊
//   │   Business ...
//   └──────────┴────────────┴─────────────┴──
//       Genesis  Custom Built    Product    Commodity   Evolution
//
//   - A component is `●` (`o` in ASCII mode) with its name beside it, on the
//     right if there is room, else the left or the rows above and below.
//     An anchor is its name alone, centred on the spot. `(build)`, `(buy)`,
//     `(outsource)` and `(market)` follow the name, and `inertia` adds `┃`.
//   - A pipeline is a box round its components, with
//     the parent `□` above it; links to the parent end there.
//   - Links are straight lines between the markers (`╱ ╲ ─ │`; dotted for
//     `-.->`), with an arrowhead for `+>` `+<` `+<>`; a link label sits above
//     the middle. `evolve` is a dotted arrow to the right of the component.
//   - Annotations are numbered `(1)` marks; their texts are listed under the
//     map when the diagram has an `annotations [x, y]` line, as Mermaid shows
//     them in a box. Notes are text at their spot, accelerators `>>` and
//     deaccelerators `<<` before their name.
//   - `size` and `label [dx, dy]` offsets only matter for the SVG. accTitle
//     and accDescr are not printed (see the pie renderer). Widths are display
//     widths, so CJK and emoji names line up.
// ============================================================================

import {
  parseWardley,
  WARDLEY_DEFAULT_STAGES,
  CHART_ACCENT_FALLBACK,
} from '@zombie-mermaid/mermaid-parser'
import type { WardleyMap, WardleyNode } from '@zombie-mermaid/mermaid-parser'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'
import { colorizeText } from './ansi.ts'
import { displayWidth } from './display-width.ts'

/** Chart size in cells, inside the axes. */
const W = 72
const H = 22

type Role = 'label' | 'node' | 'line' | 'axis' | 'accent'

interface Cell {
  /** The character; `''` for the second cell of a wide one. */
  ch: string
  role: Role
}

const UNI = {
  node: '●',
  parent: '□',
  inertia: '┃',
  h: '─',
  v: '│',
  up: '╱',
  down: '╲',
  dotH: '┄',
  dotV: '┆',
  divider: '┊',
  corner: '└',
  tick: '┴',
  boxTL: '┌',
  boxTR: '┐',
  boxBL: '└',
  boxBR: '┘',
  arrows: { right: '▸', left: '◂', up: '▴', down: '▾' },
  trend: '┄',
  trendHead: '▸',
}
const ASC = {
  node: 'o',
  parent: '#',
  inertia: '!',
  h: '-',
  v: '|',
  up: '/',
  down: '\\',
  dotH: '.',
  dotV: '.',
  divider: ':',
  corner: '+',
  tick: '+',
  boxTL: '+',
  boxTR: '+',
  boxBL: '+',
  boxBR: '+',
  arrows: { right: '>', left: '<', up: '^', down: 'v' },
  trend: '.',
  trendHead: '>',
}

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v))

export function renderWardleyAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const map = parseWardley(text)
  const g = config.useAscii ? ASC : UNI
  const color: Record<Role, string> = {
    label: theme.fg,
    node: theme.fg,
    line: theme.line,
    axis: theme.border,
    accent: theme.accent ?? CHART_ACCENT_FALLBACK,
  }
  const paint = (s: string, role: Role): string =>
    colorizeText(s, color[role], colorMode)

  const grid: Array<Array<Cell | null>> = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => null),
  )
  const inside = (row: number, col: number): boolean =>
    row >= 0 && row < H && col >= 0 && col < W
  const put = (row: number, col: number, ch: string, role: Role): void => {
    if (inside(row, col)) (grid[row] as Array<Cell | null>)[col] = { ch, role }
  }
  /** Write `s` from `col`, wide characters taking two cells; returns its width. */
  const write = (row: number, col: number, s: string, role: Role): number => {
    let c = col
    for (const ch of Array.from(s)) {
      const w = displayWidth(ch)
      if (w === 0) continue
      put(row, c, ch, role)
      if (w === 2) put(row, c + 1, '', role)
      c += w
    }
    return c - col
  }
  /** Is `width` cells at `col` free of text and markers (lines may be written over)? */
  const free = (row: number, col: number, width: number): boolean => {
    if (row < 0 || row >= H || col < 0 || col + width > W) return false
    for (let c = col; c < col + width; c++) {
      const cell = (grid[row] as Array<Cell | null>)[c]
      if (cell && (cell.role === 'label' || cell.role === 'node')) return false
    }
    return true
  }
  /** Put text at the first free spot of `spots` (else the first, clipped into the grid). */
  const place = (
    s: string,
    spots: Array<[number, number]>,
    role: Role,
  ): void => {
    const w = displayWidth(s)
    const spot =
      spots.find(([r, c]) => free(r, c, w)) ?? (spots[0] as [number, number])
    write(spot[0], clamp(spot[1], 0, Math.max(0, W - w)), s, role)
  }

  const col = (x: number): number => Math.round((x / 100) * (W - 1))
  const row = (y: number): number => Math.round(((100 - y) / 100) * (H - 1))

  // Stage columns.
  const stages =
    map.stages && map.stages.length > 0
      ? map.stages
      : [...WARDLEY_DEFAULT_STAGES]
  const bounds =
    map.stageBoundaries && map.stageBoundaries.length === stages.length
      ? map.stageBoundaries
      : stages.map((_, i) => (i + 1) / stages.length)
  const edges = [0, ...bounds].map((b) => Math.round(b * (W - 1)))
  for (let i = 1; i < stages.length; i++)
    for (let r = 0; r < H; r++) put(r, edges[i] as number, g.divider, 'line')

  // Node positions (a pipeline moves its parent above the box).
  const pos = new Map<string, { c: number; r: number; node: WardleyNode }>()
  for (const node of map.nodes)
    pos.set(node.id, { c: col(node.x), r: row(node.y), node })
  const boxes: Array<{ from: number; to: number; r: number }> = []
  for (const pipeline of map.pipelines) {
    const members = pipeline.componentIds
      .map((id) => pos.get(id))
      .filter((m): m is NonNullable<typeof m> => m !== undefined)
    const parent = pos.get(pipeline.nodeId)
    if (members.length === 0) continue
    const from = Math.min(...members.map((m) => m.c))
    const to = Math.max(...members.map((m) => m.c))
    const r = (members[0] as NonNullable<typeof parent>).r
    boxes.push({ from, to, r })
    if (parent) {
      parent.c = Math.round((from + to) / 2)
      parent.r = Math.max(0, r - 2)
    }
  }
  for (const { from, to, r } of boxes) {
    const l = Math.max(0, from - 2)
    const rt = Math.min(W - 1, to + 2)
    for (let c = l + 1; c < rt; c++) {
      put(r - 1, c, g.h, 'axis')
      put(r + 1, c, g.h, 'axis')
    }
    put(r - 1, l, g.boxTL, 'axis')
    put(r - 1, rt, g.boxTR, 'axis')
    put(r + 1, l, g.boxBL, 'axis')
    put(r + 1, rt, g.boxBR, 'axis')
    put(r, l, g.v, 'axis')
    put(r, rt, g.v, 'axis')
  }

  // Links: a straight line between the markers, an arrowhead per flow.
  const inPipeline = new Map<string, Set<string>>()
  for (const p of map.pipelines)
    inPipeline.set(p.nodeId, new Set(p.componentIds))
  const labels: Array<{ c: number; r: number; text: string }> = []
  for (const link of map.links) {
    const a = pos.get(link.source)
    const b = pos.get(link.target)
    if (!a || !b || inPipeline.get(link.target)?.has(link.source)) continue
    const pts = line(a.c, a.r, b.c, b.r)
    const inner = pts.slice(1, -1)
    inner.forEach((pt, i) => {
      // The character follows the step to the next cell: across, down or diagonal.
      const next = pts[i + 2] as { c: number; r: number }
      const dc = next.c - pt.c
      const dr = next.r - pt.r
      if (link.dashed && i % 2 === 1) return
      if (dr === 0) put(pt.r, pt.c, link.dashed ? g.dotH : g.h, 'line')
      else if (dc === 0) put(pt.r, pt.c, link.dashed ? g.dotV : g.v, 'line')
      else put(pt.r, pt.c, dc * dr < 0 ? g.up : g.down, 'line')
    })
    const head = (
      at: { c: number; r: number },
      to: { c: number; r: number },
    ): void => {
      const dc = to.c - at.c
      const dr = to.r - at.r
      const ch =
        Math.abs(dc) >= Math.abs(dr)
          ? dc >= 0
            ? g.arrows.right
            : g.arrows.left
          : dr >= 0
            ? g.arrows.down
            : g.arrows.up
      put(at.r, at.c, ch, 'line')
    }
    if (inner.length > 0) {
      if (link.flow === 'forward' || link.flow === 'bidirectional')
        head(inner[inner.length - 1] as { c: number; r: number }, b)
      if (link.flow === 'backward' || link.flow === 'bidirectional')
        head(inner[0] as { c: number; r: number }, a)
    }
    if (link.label)
      labels.push({
        c: Math.round((a.c + b.c) / 2),
        r: Math.round((a.r + b.r) / 2),
        text: link.label,
      })
  }

  // Trends: a dotted arrow along the row, from the node to the target.
  for (const t of map.trends) {
    const o = pos.get(t.nodeId)
    if (!o) continue
    const to = col(t.targetX)
    const step = to >= o.c ? 1 : -1
    for (let c = o.c + 2 * step; c !== to; c += step)
      put(o.r, c, g.trend, 'accent')
    if (Math.abs(to - o.c) > 1)
      put(o.r, to, step > 0 ? g.trendHead : g.arrows.left, 'accent')
  }

  // Nodes, then their labels (first free spot: right, left, above, below).
  for (const { c, r, node } of pos.values()) {
    if (node.kind !== 'anchor') {
      put(r, c, node.isPipelineParent ? g.parent : g.node, 'node')
      if (node.inertia) put(r, c + 1, g.inertia, 'node')
    }
  }
  for (const { c, r, node } of pos.values()) {
    const tag = node.strategy ? ` (${node.strategy})` : ''
    const s = node.label + tag
    const w = displayWidth(s)
    if (node.kind === 'anchor') {
      place(
        s,
        [
          [r, c - Math.floor(w / 2)],
          [r - 1, c - Math.floor(w / 2)],
          [r + 1, c - Math.floor(w / 2)],
        ],
        'label',
      )
      continue
    }
    const start = c + (node.inertia ? 3 : 2)
    place(
      s,
      [
        [r, start],
        [r, c - 2 - w],
        [r - 1, start],
        [r + 1, start],
        [r - 1, c - 2 - w],
        [r + 1, c - 2 - w],
      ],
      'label',
    )
  }
  for (const l of labels) {
    const w = displayWidth(l.text)
    place(
      l.text,
      [
        [l.r - 1, l.c - Math.floor(w / 2)],
        [l.r + 1, l.c - Math.floor(w / 2)],
      ],
      'label',
    )
  }

  // Annotations, notes, accelerators.
  for (const a of map.annotations)
    place(`(${a.number})`, [[row(a.y), col(a.x) - 1]], 'accent')
  for (const n of map.notes) place(n.text, [[row(n.y), col(n.x)]], 'label')
  for (const a of map.accelerators)
    place(`>> ${a.name}`, [[row(a.y), col(a.x)]], 'accent')
  for (const a of map.deaccelerators)
    place(`<< ${a.name}`, [[row(a.y), col(a.x)]], 'accent')

  return assemble(map, grid, stages, edges, g, paint)
}

/** The cells of a straight line from one point to another, ends included (Bresenham). */
function line(
  c0: number,
  r0: number,
  c1: number,
  r1: number,
): Array<{ c: number; r: number }> {
  const out: Array<{ c: number; r: number }> = []
  const dc = Math.abs(c1 - c0)
  const dr = -Math.abs(r1 - r0)
  const sc = c0 < c1 ? 1 : -1
  const sr = r0 < r1 ? 1 : -1
  let err = dc + dr
  let c = c0
  let r = r0
  for (;;) {
    out.push({ c, r })
    if (c === c1 && r === r1) return out
    const e2 = 2 * err
    if (e2 >= dr) {
      err += dr
      c += sc
    }
    if (e2 <= dc) {
      err += dc
      r += sr
    }
  }
}

/** Frame the grid with the axes, stage names, title and annotation list. */
function assemble(
  map: WardleyMap,
  grid: Array<Array<Cell | null>>,
  stages: readonly string[],
  edges: number[],
  g: typeof UNI,
  paint: (s: string, role: Role) => string,
): string {
  const out: string[] = []
  const width = W + 1
  if (map.title) {
    const left = Math.max(0, Math.floor((width - displayWidth(map.title)) / 2))
    out.push(' '.repeat(left) + paint(map.title, 'label'), '')
  }
  out.push(paint('Visibility', 'label'))
  for (const cells of grid) {
    let s = paint(g.v, 'axis')
    let run = ''
    let runRole: Role | undefined
    const flush = (): void => {
      if (run) s += paint(run, runRole as Role)
      run = ''
    }
    for (const cell of cells) {
      if (cell === null) {
        if (runRole !== undefined) flush()
        runRole = undefined
        s += ' '
        continue
      }
      if (cell.role !== runRole) {
        flush()
        runRole = cell.role
      }
      run += cell.ch
    }
    flush()
    out.push(s)
  }
  let axis = g.corner
  for (let c = 0; c < W; c++)
    axis += edges.slice(1, -1).includes(c) ? g.tick : g.h
  out.push(paint(axis, 'axis'))
  // Stage names centred under their stages (cut to fit).
  let names = ' '
  stages.forEach((name, i) => {
    const span =
      (edges[i + 1] ?? W - 1) - (edges[i] as number) + (i === 0 ? 1 : 0)
    let s = name
    while (displayWidth(s) > span - 1 && s.length > 1) s = s.slice(0, -1)
    const pad = Math.max(0, Math.floor((span - displayWidth(s)) / 2))
    const target = (edges[i] as number) + (i === 0 ? 0 : 1) + pad
    names += ' '.repeat(Math.max(0, target - displayWidth(names) + 1)) + s
  })
  out.push(paint(names, 'label') + '  ' + paint('Evolution', 'label'))
  if (map.annotationsBox && map.annotations.some((a) => a.text)) {
    out.push('')
    for (const a of [...map.annotations]
      .filter((x) => x.text)
      .sort((x, y) => x.number - y.number))
      out.push(paint(`${a.number}. ${a.text}`, 'label'))
  }
  return out.join('\n')
}
