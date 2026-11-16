// ============================================================================
// ASCII renderer — Block diagrams
//
// Mermaid has no text mode for block diagrams, so there is no reference output
// to match. The SVG is a grid, and a grid has a direct text form: every block
// is a box, all boxes in a group share one cell size (the widest label, a
// block spanning N columns counting 1/N of its width), cells fill left to right
// in `columns` columns, and a `block ... end` group is a larger box around its
// cells:
//
//   ┌───────┐ ┌───────────────────┐
//   │   a   │ │         b         │
//   └───────┘ └───────────────────┘
//   ┌─────────────────────────────┐
//   │ ┌───────┐         ┌───────┐ │
//   │ │   c   │         │   d   │ │
//   │ └───────┘         └───────┘ │
//   └─────────────────────────────┘
//
//   - Round blocks use rounded corners (Unicode only; ASCII keeps `+`).
//   - Every other shape is the same box with its own delimiters, the glyphs the
//     flowchart renderer gives that shape (shapes/corners.ts): `◯` corners for a
//     circle, `◎` double circle, `◇` diamond, `⌜⌝⌞⌟` hexagon, `(` `)` stadium,
//     `/ \` trapezoid, `╭╮╰╯` and a rim line under the top for a cylinder, a
//     second bar inside each side for a subroutine, a `>` in the left side of an
//     asymmetric block, `/` or `\` corners leaning right or left; a block arrow
//     is a plain box with an arrow head in the middle of each side it points to.
//   - `space` leaves its cell empty.
//   - Cells are one column apart and touch vertically; a diagram with links
//     leaves room between them (4 columns, 2 rows, wider for a link label).
//   - A link is a straight line in that room between two blocks that share a
//     row or a column, else one elbow; it never overwrites a box. The end gets
//     an arrow head (`▶` `>`), `x` or `o`; `==` draws `═`/`║` (`=`), `-.-` `┄`/`┆` (`.`/`:`).
//   - Frames are painted in the line colour, labels in the foreground.
//   - Widths are display widths (CJK and emoji labels line up).
// ============================================================================

import { parseBlock } from '@zombie-mermaid/mermaid-parser'
import type { BlockEdge, BlockNode } from '@zombie-mermaid/mermaid-parser'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'
import { colorizeText } from './ansi.ts'
import { displayWidth } from './display-width.ts'
import { SHAPE_CORNERS } from './shapes/corners.ts'
import type { AsciiNodeShape } from './types.ts'

const UNI = {
  h: '─',
  v: '│',
  tl: '┌',
  tr: '┐',
  bl: '└',
  br: '┘',
  rtl: '╭',
  rtr: '╮',
  rbl: '╰',
  rbr: '╯',
  // Links: line, thick, dotted (horizontal, vertical), arrow heads right/left/down/up, corners
  lh: '─',
  lv: '│',
  th: '═',
  tv: '║',
  dh: '┄',
  dv: '┆',
  ar: '▶',
  al: '◀',
  ad: '▼',
  au: '▲',
  cTL: '┌',
  cTR: '┐',
  cBL: '└',
  cBR: '┘',
}
const ASC = {
  h: '-',
  v: '|',
  tl: '+',
  tr: '+',
  bl: '+',
  br: '+',
  rtl: '+',
  rtr: '+',
  rbl: '+',
  rbr: '+',
  lh: '-',
  lv: '|',
  th: '=',
  tv: '|',
  dh: '.',
  dv: ':',
  ar: '>',
  al: '<',
  ad: 'v',
  au: '^',
  cTL: '+',
  cTR: '+',
  cBL: '+',
  cBR: '+',
}

/** The flowchart shape whose corner glyphs a block shape borrows. */
const CORNER_SHAPE: Partial<Record<BlockNode['shape'], AsciiNodeShape>> = {
  circle: 'circle',
  doublecircle: 'doublecircle',
  diamond: 'diamond',
  hexagon: 'hexagon',
  stadium: 'stadium',
  subroutine: 'subroutine',
  cylinder: 'cylinder',
  rect_left_inv_arrow: 'asymmetric',
  trapezoid: 'trapezoid',
  inv_trapezoid: 'trapezoid-alt',
  lean_right: 'parallelogram',
  lean_left: 'parallelogram-alt',
}

/** Extra columns and rows a shape's delimiters need around its label. */
const EXTRA: Partial<Record<BlockNode['shape'], Size>> = {
  subroutine: { w: 2, h: 0 },
  cylinder: { w: 0, h: 1 },
}

/** Room between neighbouring cells: columns across, rows down. */
interface Gaps {
  x: number
  y: number
}
const PLAIN_GAPS: Gaps = { x: 1, y: 0 }
/** Columns between a group's frame and its cells. */
const INSET = 1

/** One screen cell: a glyph (`''` for the second half of a wide one) and its paint. */
interface Cell {
  s: string
  line: boolean
}
type Canvas = Cell[][]

const blank = (w: number, h: number): Canvas =>
  Array.from({ length: h }, () =>
    Array.from({ length: w }, () => ({ s: ' ', line: false })),
  )

const labelLines = (label: string): string[] =>
  label.split(/<br\s*\/?>/i).map((l) => l.replace(/\s+/g, ' ').trim())

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface Size {
  w: number
  h: number
}

/** Number of columns a group lays its children in, and its rows. */
function gridOf(node: BlockNode): { xSize: number; ySize: number } {
  const items = node.children.reduce((n, c) => n + c.widthInColumns, 0)
  let xSize = node.children.length
  const columns = node.columns ?? -1
  if (columns > 0 && columns < items) xSize = columns
  return {
    xSize: Math.max(1, xSize),
    ySize: Math.ceil(items / Math.max(1, xSize)),
  }
}

/** Natural size of a node's box. */
function measure(node: BlockNode, gap: Gaps, root = false): Size {
  if (node.type === 'node') {
    const lines = labelLines(node.label)
    const extra = EXTRA[node.shape] ?? { w: 0, h: 0 }
    return {
      w: Math.max(0, ...lines.map(displayWidth)) + 4 + extra.w,
      h: lines.length + 2 + extra.h,
    }
  }
  const { xSize, ySize } = gridOf(node)
  let cw = 0
  let ch = 0
  for (const c of node.children) {
    if (c.type === 'space') continue
    const s = measure(c, gap)
    cw = Math.max(cw, Math.ceil((s.w + gap.x) / c.widthInColumns) - gap.x)
    ch = Math.max(ch, s.h)
  }
  const inset = root ? 0 : INSET + 1
  return {
    w: xSize * cw + (xSize - 1) * gap.x + 2 * inset,
    h: ySize * ch + (ySize - 1) * gap.y + (root ? 0 : 2),
  }
}

/** The marks inside a shape's frame: a rim, inner bars, a notch, arrow heads. */
function decorate(
  put: (cx: number, cy: number, s: string, line: boolean) => void,
  node: BlockNode,
  x: number,
  y: number,
  w: number,
  h: number,
  g: typeof UNI,
): void {
  const mid = y + Math.floor(h / 2)
  const midX = x + Math.floor(w / 2)
  switch (node.shape) {
    case 'cylinder':
      // The rim of the top ellipse, as the flowchart cylinder draws it.
      put(x, y + 1, g.v, true)
      put(x + w - 1, y + 1, g.v, true)
      for (let i = 1; i < w - 1; i++) put(x + i, y + 1, g.h, true)
      break
    case 'subroutine':
      for (let j = 1; j < h - 1; j++) {
        put(x + 1, y + j, g.v, true)
        put(x + w - 2, y + j, g.v, true)
      }
      break
    case 'rect_left_inv_arrow':
      put(x, mid, '>', true)
      break
    case 'block_arrow': {
      // Mermaid reads a direction by its exact name; `x` is right and left, `y` up and down.
      const dirs = new Set<string>()
      for (const d of node.directions) {
        if (d === 'x') dirs.add('right').add('left')
        else if (d === 'y') dirs.add('up').add('down')
        else dirs.add(d)
      }
      if (dirs.has('right')) put(x + w - 1, mid, g.ar, true)
      if (dirs.has('left')) put(x, mid, g.al, true)
      if (dirs.has('up')) put(midX, y, g.au, true)
      if (dirs.has('down')) put(midX, y + h - 1, g.ad, true)
      break
    }
    default:
  }
}

/** Draw `node` into `canvas` with its top-left at (x, y), `size` wide and tall. */
function draw(
  canvas: Canvas,
  node: BlockNode,
  x: number,
  y: number,
  size: Size,
  g: typeof UNI,
  gap: Gaps,
  rects: Map<string, Rect>,
  root = false,
): void {
  const put = (cx: number, cy: number, s: string, line: boolean): void => {
    const row = canvas[cy]
    if (row?.[cx] !== undefined) row[cx] = { s, line }
  }
  if (!root) {
    if (!rects.has(node.id)) rects.set(node.id, { x, y, w: size.w, h: size.h })
    const round = node.type === 'node' && node.shape === 'round'
    const { w, h } = size
    const corner = node.type === 'node' ? CORNER_SHAPE[node.shape] : undefined
    const c = corner
      ? SHAPE_CORNERS[corner][g === UNI ? 'unicode' : 'ascii']
      : round
        ? { tl: g.rtl, tr: g.rtr, bl: g.rbl, br: g.rbr }
        : { tl: g.tl, tr: g.tr, bl: g.bl, br: g.br }
    put(x, y, c.tl, true)
    put(x + w - 1, y, c.tr, true)
    put(x, y + h - 1, c.bl, true)
    put(x + w - 1, y + h - 1, c.br, true)
    for (let i = 1; i < w - 1; i++) {
      put(x + i, y, g.h, true)
      put(x + i, y + h - 1, g.h, true)
    }
    for (let j = 1; j < h - 1; j++) {
      put(x, y + j, g.v, true)
      put(x + w - 1, y + j, g.v, true)
    }
    if (node.type === 'node') decorate(put, node, x, y, w, h, g)
  }
  if (node.type === 'node') {
    const lines = labelLines(node.label)
    const rim = EXTRA[node.shape]?.h ?? 0
    const top = y + 1 + rim + Math.floor((size.h - 2 - rim - lines.length) / 2)
    lines.forEach((text, k) => {
      const left = x + 1 + Math.floor((size.w - 2 - displayWidth(text)) / 2)
      let cx = left
      for (const ch of text) {
        const dw = displayWidth(ch)
        put(cx, top + k, ch, false)
        if (dw === 2) put(cx + 1, top + k, '', false)
        cx += dw
      }
    })
    return
  }

  const { xSize, ySize } = gridOf(node)
  const inset = root ? 0 : INSET + 1
  const innerW = size.w - 2 * inset
  const innerH = size.h - (root ? 0 : 2)
  const cw = Math.floor((innerW - (xSize - 1) * gap.x) / xSize)
  const ch = Math.floor((innerH - (ySize - 1) * gap.y) / ySize)
  const columns = node.columns ?? -1
  let pos = 0
  for (const child of node.children) {
    const px = columns > 0 ? pos % columns : pos
    const py = columns > 0 ? Math.floor(pos / columns) : 0
    const span = Math.min(
      child.widthInColumns,
      columns > 0 ? columns - px : child.widthInColumns,
    )
    if (child.type !== 'space') {
      const w = cw * child.widthInColumns + (child.widthInColumns - 1) * gap.x
      draw(
        canvas,
        child,
        x + inset + px * (cw + gap.x),
        y + (root ? 0 : 1) + py * (ch + gap.y),
        { w, h: ch },
        g,
        gap,
        rects,
      )
    }
    pos += span
  }
}

/** Draw each link between the boxes in `rects`, only on blank cells. */
function drawEdges(
  canvas: Canvas,
  edges: BlockEdge[],
  rects: Map<string, Rect>,
  g: typeof UNI,
): void {
  /**
   * The cheapest clear route (a cell per step, a bend costing 6) from a side of `a` to a side of
   * `b`, as the cells where it starts, bends and ends; undefined when every way is blocked.
   */
  const search = (a: Rect, b: Rect): [number, number][] | undefined => {
    const D: [number, number, 'r' | 'l' | 'd' | 'u'][] = [
      [1, 0, 'r'],
      [-1, 0, 'l'],
      [0, 1, 'd'],
      [0, -1, 'u'],
    ]
    const ring = (r: Rect): [number, number, number][] => {
      const out: [number, number, number][] = []
      for (let x = r.x; x < r.x + r.w; x++) {
        out.push([x, r.y - 1, 3], [x, r.y + r.h, 2])
      }
      for (let y = r.y; y < r.y + r.h; y++) {
        out.push([r.x - 1, y, 1], [r.x + r.w, y, 0])
      }
      return out
    }
    const key = (x: number, y: number, d: number): string => `${x},${y},${d}`
    // The way into `b` from each cell beside it is the opposite of the way out of `b`.
    const goal = new Map<string, true>()
    for (const [x, y, out] of ring(b)) goal.set(key(x, y, out ^ 1), true)
    const dist = new Map<string, number>()
    const prev = new Map<string, string>()
    // Costs are small whole numbers, so a queue per cost does for a priority queue.
    const queue: [number, number, number][][] = []
    let pending = 0
    const push = (c: number, x: number, y: number, d: number): void => {
      ;(queue[c] ??= []).push([x, y, d])
      pending++
    }
    // Leave `a` with a straight stem of two cells, so a bend never sits against its frame.
    for (const [x, y, out] of ring(a)) {
      const [dx, dy] = D[out]!
      if (blocked(x, y) || blocked(x + dx, y + dy)) continue
      dist.set(key(x + dx, y + dy, out), 0)
      prev.set(key(x + dx, y + dy, out), key(x, y, out))
      push(0, x + dx, y + dy, out)
    }
    for (let c = 0; pending > 0; c++) {
      for (const [x, y, d] of queue[c] ?? []) {
        pending--
        const here = key(x, y, d)
        if (c > (dist.get(here) ?? Infinity)) continue
        if (goal.has(here)) {
          const path: [number, number][] = []
          for (let k: string | undefined = here; k; k = prev.get(k)) {
            const [px, py] = k.split(',').map(Number) as [number, number]
            const last = path[path.length - 1]
            const before = path[path.length - 2]
            // Keep only the ends and the bends.
            if (
              last &&
              before &&
              (before[0] - last[0]) * (last[1] - py) ===
                (before[1] - last[1]) * (last[0] - px)
            )
              path.pop()
            path.push([px, py])
          }
          return path.reverse()
        }
        D.forEach(([dx, dy], nd) => {
          const nx = x + dx
          const ny = y + dy
          if (blocked(nx, ny)) return
          const nc = c + 1 + (nd === d ? 0 : 6)
          const nk = key(nx, ny, nd)
          if (nc < (dist.get(nk) ?? Infinity)) {
            dist.set(nk, nc)
            prev.set(nk, here)
            push(nc, nx, ny, nd)
          }
        })
      }
    }
    return undefined
  }
  // Groups around both ends of the link you are drawing: their frames are not in its way.
  let enclosing = new Set<Rect>()
  const blocked = (x: number, y: number): boolean => {
    const c = canvas[y]?.[x]
    if (c === undefined || c.s !== ' ') return true
    for (const r of rects.values())
      if (
        !enclosing.has(r) &&
        x >= r.x &&
        x < r.x + r.w &&
        y >= r.y &&
        y < r.y + r.h
      )
        return true
    return false
  }
  const put = (x: number, y: number, s: string, line = true): boolean => {
    if (blocked(x, y)) return false
    canvas[y]![x] = { s, line }
    return true
  }
  const head = (arrow: string, dir: 'r' | 'l' | 'd' | 'u'): string =>
    arrow === 'arrow_point'
      ? { r: g.ar, l: g.al, d: g.ad, u: g.au }[dir]
      : arrow === 'arrow_cross'
        ? 'x'
        : arrow === 'arrow_circle'
          ? 'o'
          : ''
  const text = (x: number, y: number, label: string): void => {
    let cx = x
    for (const ch of label) {
      if (put(cx, y, ch, false) && displayWidth(ch) === 2)
        put(cx + 1, y, '', false)
      cx += displayWidth(ch)
    }
  }
  for (const e of edges) {
    const a = rects.get(e.start)
    const b = rects.get(e.end)
    if (!a || !b || a === b) continue
    enclosing = new Set(
      [...rects.values()].filter(
        (r) =>
          r !== a &&
          r !== b &&
          r.x <= Math.min(a.x, b.x) &&
          r.y <= Math.min(a.y, b.y) &&
          r.x + r.w >= Math.max(a.x + a.w, b.x + b.w) &&
          r.y + r.h >= Math.max(a.y + a.h, b.y + b.h),
      ),
    )
    const hch =
      e.thickness === 'thick' ? g.th : e.pattern === 'dotted' ? g.dh : g.lh
    const vch =
      e.thickness === 'thick' ? g.tv : e.pattern === 'dotted' ? g.dv : g.lv
    const label = e.label.replace(/<br\s*\/?>/gi, ' ').trim()
    const ys = Math.max(a.y, b.y)
    const ye = Math.min(a.y + a.h, b.y + b.h) - 1
    const xs = Math.max(a.x, b.x)
    const xe = Math.min(a.x + a.w, b.x + b.w) - 1
    if (ys <= ye) {
      // Same row band: a horizontal line through the gap.
      const y = Math.floor((ys + ye) / 2)
      const east = b.x > a.x
      const x0 = east ? a.x + a.w : b.x + b.w
      const x1 = east ? b.x - 1 : a.x - 1
      for (let x = x0; x <= x1; x++) put(x, y, hch)
      const [s, t] = east ? [x0, x1] : [x1, x0]
      const sa = head(e.arrowTypeStart, east ? 'l' : 'r')
      const ta = head(e.arrowTypeEnd, east ? 'r' : 'l')
      if (sa) canvas[y]![s] = { s: sa, line: true }
      if (ta) canvas[y]![t] = { s: ta, line: true }
      if (label)
        text(
          x0 + Math.floor((x1 - x0 + 1 - displayWidth(label)) / 2),
          y - 1,
          label,
        )
    } else if (xs <= xe) {
      const x = Math.floor((xs + xe) / 2)
      const south = b.y > a.y
      const y0 = south ? a.y + a.h : b.y + b.h
      const y1 = south ? b.y - 1 : a.y - 1
      for (let y = y0; y <= y1; y++) put(x, y, vch)
      const [s, t] = south ? [y0, y1] : [y1, y0]
      const sa = head(e.arrowTypeStart, south ? 'u' : 'd')
      const ta = head(e.arrowTypeEnd, south ? 'd' : 'u')
      if (sa) canvas[s]![x] = { s: sa, line: true }
      if (ta) canvas[t]![x] = { s: ta, line: true }
      if (label) text(x + 2, Math.floor((y0 + y1) / 2), label)
    } else {
      // Diagonal: one elbow, out of a side of `a` and into a side of `b`. Try the two L routes and,
      // when a block sits on both, a route down the gap beside `a`; keep the first that is clear.
      const east = b.x > a.x
      const south = b.y > a.y
      const ya = a.y + Math.floor(a.h / 2)
      const yb = b.y + Math.floor(b.h / 2)
      const xa = a.x + Math.floor(a.w / 2)
      const xb = b.x + Math.floor(b.w / 2)
      const sideX = east ? a.x + a.w : a.x - 1
      const routes: [number, number][][] = [
        [
          [sideX, ya],
          [xb, ya],
          [xb, south ? b.y - 1 : b.y + b.h],
        ],
        [
          [xa, south ? a.y + a.h : a.y - 1],
          [xa, yb],
          [east ? b.x - 1 : b.x + b.w, yb],
        ],
        [
          [sideX, ya],
          [sideX + (east ? 1 : -1), ya],
          [sideX + (east ? 1 : -1), yb],
          [east ? b.x - 1 : b.x + b.w, yb],
        ],
      ]
      const cells = (r: [number, number][]): [number, number][] => {
        const out: [number, number][] = []
        r.forEach(([x, y], i) => {
          const [px, py] = r[i - 1] ?? [x, y]
          const n = Math.max(Math.abs(x - px), Math.abs(y - py))
          for (let k = i === 0 ? 0 : 1; k <= n; k++)
            out.push([px + Math.sign(x - px) * k, py + Math.sign(y - py) * k])
        })
        return out
      }
      const route =
        routes.find((r) => cells(r).every(([x, y]) => !blocked(x, y))) ??
        search(a, b)
      // No clear route: draw nothing rather than a link that stops at a block.
      if (route === undefined) continue
      const dir = (
        [x0, y0]: [number, number],
        [x1, y1]: [number, number],
      ): 'r' | 'l' | 'd' | 'u' =>
        x1 !== x0 ? (x1 > x0 ? 'r' : 'l') : y1 > y0 ? 'd' : 'u'
      const turn: Record<string, string> = {
        rd: g.cTR,
        ru: g.cBR,
        ld: g.cTL,
        lu: g.cBL,
        dr: g.cBL,
        dl: g.cBR,
        ur: g.cTL,
        ul: g.cTR,
      }
      const opposite = { r: 'l', l: 'r', d: 'u', u: 'd' } as const
      for (let i = 1; i < route.length - 1; i++)
        put(
          route[i]![0],
          route[i]![1],
          turn[dir(route[i - 1]!, route[i]!) + dir(route[i]!, route[i + 1]!)]!,
        )
      const walk = cells(route)
      for (const [x, y] of walk) {
        const horizontal = route.some(
          ([vx, vy], i) =>
            i > 0 &&
            route[i - 1]![1] === vy &&
            y === vy &&
            x >= Math.min(vx, route[i - 1]![0]) &&
            x <= Math.max(vx, route[i - 1]![0]),
        )
        put(x, y, horizontal ? hch : vch)
      }
      const first = route[0]!
      const last = route[route.length - 1]!
      const sa = head(e.arrowTypeStart, opposite[dir(first, route[1]!)])
      const ta = head(e.arrowTypeEnd, dir(route[route.length - 2]!, last))
      if (sa) canvas[first[1]]![first[0]] = { s: sa, line: true }
      if (ta) canvas[last[1]]![last[0]] = { s: ta, line: true }
      if (label) text(Math.min(first[0], route[1]![0]) + 1, first[1] - 1, label)
    }
  }
}

export function renderBlockAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const diagram = parseBlock(text)
  const g = config.useAscii ? ASC : UNI
  const widest = Math.max(0, ...diagram.edges.map((e) => displayWidth(e.label)))
  const gap: Gaps =
    diagram.edges.length > 0 ? { x: Math.max(4, widest + 2), y: 2 } : PLAIN_GAPS
  const size = measure(diagram.root, gap, true)
  if (size.w <= 0 || size.h <= 0) return ''
  // A label beside a vertical link can reach past the boxes; trailing blanks are trimmed on output.
  const canvas = blank(
    size.w + (diagram.edges.length > 0 ? widest + 3 : 0),
    size.h,
  )
  const rects = new Map<string, Rect>()
  draw(canvas, diagram.root, 0, 0, size, g, gap, rects, true)
  drawEdges(canvas, diagram.edges, rects, g)

  return canvas
    .map((row0) => {
      let end = row0.length
      while (end > 0 && row0[end - 1]!.s === ' ') end--
      const row = row0.slice(0, end)
      let out = ''
      let run = ''
      let runLine = false
      const flush = () => {
        if (run !== '')
          out += colorizeText(run, runLine ? theme.line : theme.fg, colorMode)
        run = ''
      }
      for (const cell of row) {
        if (cell.line !== runLine) {
          flush()
          runLine = cell.line
        }
        run += cell.s
      }
      flush()
      return out
    })
    .join('\n')
}
