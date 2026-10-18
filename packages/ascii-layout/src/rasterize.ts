import type { FlowchartLayout } from '@zombie-mermaid/elk-layout'
import { BIT, DX, DY, route, type RouteGrid } from './route.ts'

/**
 * What to do when a node face has fewer interior cells than edge ends.
 *  - `merge-then-grow`: merge identical parallel edges (same faces, direction and arrows) into
 *    one drawn line first, then grow the box on that face by the minimum cells. Merged lines
 *    hide edge multiplicity (reported in `RasterResult.mergedGroups`).
 *  - `grow-only` ("show every edge", #2183): never merge; every edge keeps its own lane and a
 *    short face grows the box by the minimum cells. Nothing is hidden, but boxes can be far
 *    taller/wider than the layout's (expected distortion, reported in `stats.maxBoxError`).
 * A policy is just "may identical parallel edges be merged?".
 */
export type FacePolicy = 'merge-then-grow' | 'grow-only'
const POLICIES: Record<FacePolicy, { mergeIdentical: boolean }> = {
  'merge-then-grow': { mergeIdentical: true },
  'grow-only': { mergeIdentical: false },
}

export interface RasterOptions {
  /** Layout pixels per character column (default 5: keeps box proportions within ~4%). */
  cellW?: number
  /** Layout pixels per character row (default 10). */
  cellH?: number
  facePolicy?: FacePolicy
  /**
   * Target output width in columns (default 120; `Infinity` disables the cap). Met by shrinking
   * the blank gaps between node groups on the horizontal axis (rank gaps in LR/RL, node gaps in
   * TD/BT), never by scaling boxes. If boxes alone do not fit, the result is the uncapped render
   * and `RasterResult.capped` is false.
   */
  maxCols?: number
}

export const DEFAULT_MAX_COLS = 120

export interface RasterBox {
  id: string
  /** Inclusive cell rectangle in the returned text's coordinates (border included). */
  c0: number
  r0: number
  c1: number
  r1: number
}

export interface RasterStats {
  rows: number
  cols: number
  /** Width with no compression (equals `cols` when the cap did not need to act). */
  naturalCols: number
  /** Fraction of the natural inter-group gap kept on the horizontal axis (1 = uncompressed). */
  gapKept: number
  /** Worst relative size error of any box against the layout (0.04 = 4%). */
  maxBoxError: number
  boxesOver15Pct: number
  edges: number
  /** Drawn lines; `edges - lines` edges were merged into another. */
  lines: number
  merged: number
  /** Cells where two different lines cross (always at a right angle unless `relaxed`). */
  crossings: number
  /** Box cells that are not a plain border glyph or a tee on a face. */
  brokenBorderCells: number
  arrowheads: number
  /** Arrowheads whose pointed-at neighbour is a node border cell. */
  arrowheadsAdjacent: number
  /** Extra blank cells added between node groups to make every edge routable. */
  gap: number
  /** True if routing had to overlap lines: right-angle crossing rule not met. */
  relaxed: boolean
}

export interface RasterResult {
  text: string
  boxes: RasterBox[]
  /** Edge ids that were drawn as one line, one array per merged line. */
  mergedGroups: string[][]
  /** Human-readable caveat for callers to show when edges were merged (empty otherwise). */
  note: string
  /**
   * True when `stats.cols <= maxCols`. False means the cap cannot be met without scaling boxes or
   * merging lanes: `text` is then the natural-width render (`stats.cols === stats.naturalCols`)
   * and callers should fall back to another renderer or accept the width.
   */
  capped: boolean
  stats: RasterStats
}

const [N, E, S, W] = BIT
// Line glyph by direction bitmask (N=1 E=2 S=4 W=8).
const GLYPH = [
  ' ',
  '│',
  '─',
  '└',
  '│',
  '│',
  '┌',
  '├',
  '─',
  '┘',
  '─',
  '┴',
  '┐',
  '┤',
  '┬',
  '┼',
]
const ARROW = ['▲', '►', '▼', '◄']
type Face = 'T' | 'R' | 'B' | 'L'
const FACES: Face[] = ['T', 'R', 'B', 'L']
const OUT: Record<Face, number> = { T: 0, R: 1, B: 2, L: 3 }
const horizontalFace = (f: Face) => f === 'T' || f === 'B'

interface Att {
  node: number
  face: Face
  /** Layout coordinate along the face. */
  coord: number
  /** Cell along the face, assigned by lane allocation. */
  lane: number
  bundle: number
  end: 0 | 1
}
interface End {
  node: number
  face: Face
}
interface Bundle {
  members: number[]
  A: Att
  B: Att
  arrowA: boolean
  arrowB: boolean
  guide: [number, number][]
}

/** px -> cell axis. Stretches only inside node spans that need more cells than px/cell gives, and puts `gap` cells between node groups. */
function makeAxis(
  spans: { lo: number; hi: number; need: number }[],
  cell: number,
  gap: number,
  keep = 1,
) {
  const sorted = [...spans].sort((a, b) => a.lo - b.lo)
  const groups: { lo: number; hi: number; extra: number }[] = []
  for (const sp of sorted) {
    const g = groups[groups.length - 1]
    if (!g || sp.lo >= g.hi) groups.push({ lo: sp.lo, hi: sp.hi, extra: 0 })
    else g.hi = Math.max(g.hi, sp.hi)
  }
  for (const sp of sorted) {
    const g = groups.find((q) => sp.lo >= q.lo && sp.lo < q.hi)!
    const extra = Math.max(0, sp.need - Math.round((sp.hi - sp.lo) / cell))
    g.extra = Math.max(
      g.extra,
      Math.ceil((extra * (g.hi - g.lo)) / (sp.hi - sp.lo)),
    )
  }
  const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
  return (v: number) =>
    v / cell +
    groups.reduce(
      (a, g, i) =>
        a +
        g.extra * clamp01((v - g.lo) / (g.hi - g.lo)) +
        (groups[i + 1]
          ? clamp01((v - g.hi) / (groups[i + 1]!.lo - g.hi)) *
            (gap - ((1 - keep) * (groups[i + 1]!.lo - g.hi)) / cell)
          : 0),
      0,
    )
}

const pathLength = (p: [number, number][]) =>
  p
    .slice(1)
    .reduce(
      (a, q, i) => a + Math.abs(q[0] - p[i]![0]) + Math.abs(q[1] - p[i]![1]),
      0,
    )
const headingOf = (a: number[], b: number[]) =>
  b[0]! > a[0]! ? 1 : b[0]! < a[0]! ? 3 : b[1]! > a[1]! ? 2 : 0
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

function attempt(
  layout: FlowchartLayout,
  cw: number,
  ch: number,
  mergeIdentical: boolean,
  gap: number,
  relaxed: boolean,
  keep: number,
  longestFirst = false,
): RasterResult | null {
  const nodes = layout.nodes.map((n) => ({
    ...n,
    l: n.x - n.w / 2,
    r: n.x + n.w / 2,
    t: n.y - n.h / 2,
    b: n.y + n.h / 2,
    lines: n.label.split(/<br\s*\/?>|\n/i),
  }))
  const baseSize = (n: (typeof nodes)[number]) => ({
    w: Math.max(3, Math.round(n.w / cw)),
    h: Math.max(3, Math.round(n.h / ch)),
  })

  /** The node face an edge endpoint lies on. */
  const attach = (p: [number, number]): End & { coord: number } => {
    let best = { node: 0, face: 'T' as Face, coord: 0, d: Infinity }
    nodes.forEach((n, i) => {
      const inside =
        p[0] >= n.l - 2 && p[0] <= n.r + 2 && p[1] >= n.t - 2 && p[1] <= n.b + 2
      if (!inside) return
      const cand: [Face, number, number][] = [
        ['L', Math.abs(p[0] - n.l), p[1]],
        ['R', Math.abs(p[0] - n.r), p[1]],
        ['T', Math.abs(p[1] - n.t), p[0]],
        ['B', Math.abs(p[1] - n.b), p[0]],
      ]
      for (const [face, d, coord] of cand)
        if (d < best.d) best = { node: i, face, coord, d }
    })
    return best
  }
  const faceKey = (x: End) => `${x.node}.${x.face}`

  // ---- bundles: one per edge, unless identical parallel edges were merged ----
  const ed = layout.edges.map((e, i) => {
    const s = attach(e.pts[0]!)
    const t = attach(e.pts[e.pts.length - 1]!)
    const arrowS = !!e.arrowStart
    const arrowT = e.arrowEnd !== false
    return {
      i,
      s,
      t,
      arrowS,
      arrowT,
      guide: e.pts,
      sig: `${faceKey(s)}>${faceKey(t)}|${+arrowS}${+arrowT}`,
    }
  })
  const mergedSigs = new Set<string>()
  const bundleList = () => {
    const m = new Map<string, typeof ed>()
    for (const e of ed) {
      const k = mergedSigs.has(e.sig) ? e.sig : `#${e.i}`
      m.set(k, [...(m.get(k) ?? []), e])
    }
    return [...m.values()]
  }
  const faceCounts = (bs: (typeof ed)[]) => {
    const c = new Map<string, number>()
    for (const b of bs)
      for (const x of [b[0]!.s, b[0]!.t])
        c.set(faceKey(x), (c.get(faceKey(x)) ?? 0) + 1)
    return c
  }
  const capacity = (k: string) => {
    const [n, f] = k.split('.')
    const bs = baseSize(nodes[+n!]!)
    return (f === 'T' || f === 'B' ? bs.w : bs.h) - 2
  }
  if (mergeIdentical) {
    // Merge the most-duplicated signature touching an over-full face, until none is over-full.
    for (;;) {
      const over = [...faceCounts(bundleList())].find(
        ([k, c]) => c > capacity(k),
      )
      if (!over) break
      const cand = new Map<string, number>()
      for (const e of ed)
        if (
          !mergedSigs.has(e.sig) &&
          (faceKey(e.s) === over[0] || faceKey(e.t) === over[0])
        )
          cand.set(e.sig, (cand.get(e.sig) ?? 0) + 1)
      const best = [...cand]
        .filter(([, n]) => n > 1)
        .sort((a, b) => b[1] - a[1])[0]
      if (!best) break
      mergedSigs.add(best[0])
    }
  }
  const groups = bundleList()
  const counts = faceCounts(groups)
  const bundles: Bundle[] = groups.map((b, bi) => {
    const f = b[0]!
    const along = (e: (typeof ed)[number], end: 0 | 1) => {
      const x = end ? f.t : f.s
      const p = end ? e.guide[e.guide.length - 1]! : e.guide[0]!
      return horizontalFace(x.face) ? p[0] : p[1]
    }
    const att = (x: End, end: 0 | 1): Att => ({
      node: x.node,
      face: x.face,
      coord: mean(b.map((e) => along(e, end))),
      lane: 0,
      bundle: bi,
      end,
    })
    return {
      members: b.map((e) => e.i),
      A: att(f.s, 0),
      B: att(f.t, 1),
      arrowA: f.arrowS,
      arrowB: f.arrowT,
      guide: f.guide,
    }
  })

  // ---- box sizes in cells: layout size, grown only as far as label or lanes need ----
  const needW = nodes.map((n, i) =>
    Math.max(
      baseSize(n).w,
      Math.max(...n.lines.map((x) => x.length)) + 4,
      Math.max(
        0,
        ...(['T', 'B'] as Face[]).map((f) => counts.get(`${i}.${f}`) ?? 0),
      ) + 2,
    ),
  )
  const needH = nodes.map((n, i) =>
    Math.max(
      baseSize(n).h,
      n.lines.length + 2,
      Math.max(
        0,
        ...(['L', 'R'] as Face[]).map((f) => counts.get(`${i}.${f}`) ?? 0),
      ) + 2,
    ),
  )
  const fx = makeAxis(
    nodes.map((n, i) => ({ lo: n.l, hi: n.r, need: needW[i]! })),
    cw,
    gap,
    keep,
  )
  const fy = makeAxis(
    nodes.map((n, i) => ({ lo: n.t, hi: n.b, need: needH[i]! })),
    ch,
    gap,
  )
  const xs = [
    ...nodes.flatMap((n) => [fx(n.l), fx(n.r) + 1]),
    ...layout.edges.flatMap((e) => e.pts.map((p) => fx(p[0]))),
  ]
  const ys = [
    ...nodes.flatMap((n) => [fy(n.t), fy(n.b) + 1]),
    ...layout.edges.flatMap((e) => e.pts.map((p) => fy(p[1]))),
  ]
  const ox = 3 - Math.floor(Math.min(...xs))
  const oy = 3 - Math.floor(Math.min(...ys))
  const Wd = Math.ceil(Math.max(...xs)) + ox + 4
  const Ht = Math.ceil(Math.max(...ys)) + oy + 4
  const mx = (v: number) => fx(v) + ox
  const my = (v: number) => fy(v) + oy
  const box = nodes.map((n, i) => {
    const c0 = Math.round(mx(n.l))
    const r0 = Math.round(my(n.t))
    return {
      c0,
      r0,
      c1: c0 + Math.max(needW[i]!, Math.round(fx(n.r) - fx(n.l))) - 1,
      r1: r0 + Math.max(needH[i]!, Math.round(fy(n.b) - fy(n.t))) - 1,
    }
  })

  // ---- grids ----
  const at = (x: number, y: number) => y * Wd + x
  const kind = new Int32Array(Wd * Ht)
  const owner = new Int32Array(Wd * Ht).fill(-1)
  const occ = new Int32Array(Wd * Ht)
  /** Border glyph bits per box border cell (tees are added to it where an edge leaves a face). */
  const borderMask = new Map<number, number>()
  for (const b of box) {
    for (let y = b.r0; y <= b.r1; y++)
      for (let x = b.c0; x <= b.c1; x++) {
        kind[at(x, y)] = 1
        const hz = y === b.r0 || y === b.r1
        const vt = x === b.c0 || x === b.c1
        if (hz || vt)
          borderMask.set(
            at(x, y),
            (hz ? (x > b.c0 ? W : 0) | (x < b.c1 ? E : 0) : 0) |
              (vt ? (y > b.r0 ? N : 0) | (y < b.r1 ? S : 0) : 0),
          )
      }
  }
  for (const b of box)
    for (let y = b.r0 - 1; y <= b.r1 + 1; y++)
      for (let x = b.c0 - 1; x <= b.c1 + 1; x++)
        if (kind[at(x, y)] === 0) kind[at(x, y)] = 2

  // ---- lanes: interior face cells only, in ELK's order, nearest ELK's coordinate ----
  const atts = bundles.flatMap((b) => [b.A, b.B])
  nodes.forEach((_, ni) => {
    for (const f of FACES) {
      const list = atts
        .filter((a) => a.node === ni && a.face === f)
        .sort(
          (a, b) => a.coord - b.coord || a.bundle - b.bundle || a.end - b.end,
        )
      const b = box[ni]!
      const hz = horizontalFace(f)
      const lo = (hz ? b.c0 : b.r0) + 1
      const hi = (hz ? b.c1 : b.r1) - 1
      const pos = list.map((a) => Math.floor(hz ? mx(a.coord) : my(a.coord)))
      for (let i = 0; i < pos.length; i++)
        pos[i] = Math.max(pos[i]!, i ? pos[i - 1]! + 1 : lo)
      for (let i = pos.length - 1; i >= 0; i--)
        pos[i] = Math.min(pos[i]!, i < pos.length - 1 ? pos[i + 1]! - 1 : hi)
      list.forEach((a, i) => (a.lane = pos[i]!))
    }
  })
  /** The cell just outside the face, aligned with the lane: an arrowhead goes here. */
  const stem = (a: Att): [number, number] => {
    const b = box[a.node]!
    return a.face === 'T'
      ? [a.lane, b.r0 - 1]
      : a.face === 'B'
        ? [a.lane, b.r1 + 1]
        : a.face === 'L'
          ? [b.c0 - 1, a.lane]
          : [b.c1 + 1, a.lane]
  }
  bundles.forEach((b, i) => {
    for (const a of [b.A, b.B]) {
      const [x, y] = stem(a)
      owner[at(x, y)] = i * 2 + a.end
    }
  })

  // ---- route, shortest ELK path first ----
  const grid: RouteGrid = { W: Wd, H: Ht, kind, owner, occ }
  const arrows = new Map<number, string>()
  const stemCells = new Set<number>()
  const cellBundles = new Map<number, Set<number>>()
  const order = bundles
    .map((_, i) => i)
    .sort(
      (a, b) =>
        (pathLength(bundles[a]!.guide) - pathLength(bundles[b]!.guide)) *
          (longestFirst ? -1 : 1) || a - b,
    )
  for (const bi of order) {
    const bd = bundles[bi]!
    const guide = bd.guide.map((p) => [mx(p[0]), my(p[1])] as [number, number])
    const [sx, sy] = stem(bd.A)
    const [tx, ty] = stem(bd.B)
    const out0 = OUT[bd.A.face]
    const in1 = (OUT[bd.B.face] + 2) & 3
    const path = route(
      grid,
      { x: sx, y: sy, d: out0 },
      { x: tx, y: ty, d: in1 },
      bi * 2 + 1,
      guide,
      relaxed,
    )
    if (!path) return null
    path.forEach((p, i) => {
      for (const q of [path[i - 1], path[i + 1]])
        if (q) occ[at(p[0], p[1])]! |= BIT[headingOf(p, q)]!
      const set = cellBundles.get(at(p[0], p[1])) ?? new Set<number>()
      set.add(bi)
      cellBundles.set(at(p[0], p[1]), set)
    })
    // A tee goes on the face border only where an edge leaves it; an arrowhead takes the stem cell.
    const tee = (x: number, y: number, bit: number) =>
      borderMask.set(at(x, y), (borderMask.get(at(x, y)) ?? 0) | bit)
    occ[at(sx, sy)]! |= BIT[(out0 + 2) & 3]!
    if (bd.arrowA) {
      arrows.set(at(sx, sy), ARROW[(out0 + 2) & 3]!)
      occ[at(sx, sy)] = 15
    } else tee(sx - DX[out0]!, sy - DY[out0]!, BIT[out0]!)
    occ[at(tx, ty)]! |= BIT[in1]!
    if (bd.arrowB) {
      arrows.set(at(tx, ty), ARROW[in1]!)
      occ[at(tx, ty)] = 15
    } else tee(tx + DX[in1]!, ty + DY[in1]!, BIT[(in1 + 2) & 3]!)
    stemCells.add(at(sx, sy))
    stemCells.add(at(tx, ty))
  }

  // ---- paint ----
  const out: string[][] = Array.from({ length: Ht }, () =>
    Array<string>(Wd).fill(' '),
  )
  for (let i = 0; i < Wd * Ht; i++) {
    const x = i % Wd
    const y = (i / Wd) | 0
    if (borderMask.has(i)) out[y]![x] = GLYPH[borderMask.get(i)!]!
    else if (arrows.has(i)) out[y]![x] = arrows.get(i)!
    else if (occ[i]) out[y]![x] = GLYPH[occ[i]!]!
  }
  nodes.forEach((n, i) => {
    const b = box[i]!
    const r0 = b.r0 + 1 + Math.floor((b.r1 - b.r0 - 1 - n.lines.length) / 2)
    n.lines.forEach((ln, k) => {
      const start = b.c0 + Math.floor((b.c1 - b.c0 + 1 - ln.length) / 2)
      for (let j = 0; j < ln.length; j++) out[r0 + k]![start + j] = ln[j]!
    })
  })

  // ---- edge labels (best effort): on a straight horizontal run of the edge, else beside a vertical run ----
  const reserved = new Set<number>()
  for (const bi of order) {
    const txt = layout.edges[bundles[bi]!.members[0]!]!.label
    if (!txt) continue
    const free = (x: number, y: number) =>
      x >= 0 &&
      y >= 0 &&
      x < Wd &&
      y < Ht &&
      out[y]![x] === ' ' &&
      kind[at(x, y)] === 0 &&
      !reserved.has(at(x, y))
    const mine = (x: number, y: number) =>
      cellBundles.get(at(x, y))?.size === 1 &&
      cellBundles.get(at(x, y))!.has(bi) &&
      !stemCells.has(at(x, y))
    const run = (f: (k: number) => boolean) =>
      Array.from({ length: txt.length }, (_, k) => k).every(f)
    const cells = [...cellBundles]
      .filter(([, s]) => s.has(bi))
      .map(([c]) => [c % Wd, (c / Wd) | 0] as [number, number])
    const cx = mean(cells.map((c) => c[0]))
    const cy = mean(cells.map((c) => c[1]))
    const cands: [number, number][] = []
    for (const [x, y] of cells) {
      if (
        occ[at(x, y)] === (E | W) &&
        run((k) => mine(x + k, y) && occ[at(x + k, y)] === (E | W))
      )
        cands.push([x, y])
      if (
        occ[at(x, y)] === (N | S) &&
        mine(x, y) &&
        run((k) => free(x + 1 + k, y))
      )
        cands.push([x + 1, y])
    }
    cands.sort(
      (a, b) =>
        Math.hypot(a[0] + txt.length / 2 - cx, a[1] - cy) -
        Math.hypot(b[0] + txt.length / 2 - cx, b[1] - cy),
    )
    const c = cands[0]
    if (!c) continue
    for (let k = 0; k < txt.length; k++) {
      out[c[1]]![c[0] + k] = txt[k]!
      reserved.add(at(c[0] + k, c[1]))
    }
  }

  // ---- trim, then report ----
  const rows = out.map((r) => r.join('').trimEnd())
  let top = 0
  while (top < rows.length && !rows[top]) top++
  let bottom = rows.length
  while (bottom > top && !rows[bottom - 1]) bottom--
  const kept = rows.slice(top, bottom)
  const indent = Math.min(
    ...kept.filter(Boolean).map((r) => r.length - r.trimStart().length),
  )
  const text = kept.map((r) => r.slice(indent)).join('\n')

  const boxes: RasterBox[] = box.map((b, i) => ({
    id: nodes[i]!.id,
    c0: b.c0 - indent,
    r0: b.r0 - top,
    c1: b.c1 - indent,
    r1: b.r1 - top,
  }))
  let brokenBorderCells = 0
  for (const b of box)
    for (let y = b.r0; y <= b.r1; y++)
      for (let x = b.c0; x <= b.c1; x++) {
        const g = out[y]![x]!
        const t = y === b.r0,
          bt = y === b.r1,
          l = x === b.c0,
          r = x === b.c1
        const ok =
          t && l
            ? g === '┌'
            : t && r
              ? g === '┐'
              : bt && l
                ? g === '└'
                : bt && r
                  ? g === '┘'
                  : t || bt
                    ? '─┬┴'.includes(g)
                    : l || r
                      ? '│├┤'.includes(g)
                      : !'─│┌┐└┘├┤┬┴┼►◄▲▼'.includes(g)
        if (!ok) brokenBorderCells++
      }
  let adjacent = 0
  arrows.forEach((g, cell) => {
    const d = ARROW.indexOf(g)
    const x = (cell % Wd) + DX[d]!
    const y = ((cell / Wd) | 0) + DY[d]!
    if (kind[at(x, y)] === 1 && borderMask.has(at(x, y))) adjacent++
  })
  let crossings = 0
  cellBundles.forEach((s, c) => {
    if (s.size > 1 && !stemCells.has(c))
      crossings += (s.size * (s.size - 1)) / 2
  })
  let maxErr = 0
  let over = 0
  nodes.forEach((n, i) => {
    const b = box[i]!
    const e = Math.max(
      Math.abs(((b.c1 - b.c0 + 1) * cw) / n.w - 1),
      Math.abs(((b.r1 - b.r0 + 1) * ch) / n.h - 1),
    )
    maxErr = Math.max(maxErr, e)
    if (e > 0.15) over++
  })
  return {
    text,
    boxes,
    mergedGroups: bundles
      .filter((b) => b.members.length > 1)
      .map((b) => b.members.map((m) => layout.edges[m]!.id)),
    capped: true,
    note:
      layout.edges.length === bundles.length
        ? ''
        : `${layout.edges.length - bundles.length} parallel edge(s) are drawn merged into one line: merged lines hide edge multiplicity.`,
    stats: {
      rows: kept.length,
      cols: Math.max(...kept.map((r) => r.length - indent)),
      naturalCols: 0,
      gapKept: keep,
      maxBoxError: maxErr,
      boxesOver15Pct: over,
      edges: layout.edges.length,
      lines: bundles.length,
      merged: layout.edges.length - bundles.length,
      crossings,
      brokenBorderCells,
      arrowheads: arrows.size,
      arrowheadsAdjacent: adjacent,
      gap,
      relaxed,
    },
  }
}

/** Draw an ELK flowchart layout on a character grid at one uniform px-per-cell scale. */
export function rasterizeLayout(
  layout: FlowchartLayout,
  opts: RasterOptions = {},
): RasterResult {
  if (!layout.nodes.length)
    return {
      text: '',
      boxes: [],
      mergedGroups: [],
      note: '',
      capped: true,
      stats: {
        rows: 0,
        cols: 0,
        naturalCols: 0,
        gapKept: 1,
        maxBoxError: 0,
        boxesOver15Pct: 0,
        edges: 0,
        lines: 0,
        merged: 0,
        crossings: 0,
        brokenBorderCells: 0,
        arrowheads: 0,
        arrowheadsAdjacent: 0,
        gap: 0,
        relaxed: false,
      },
    }
  const {
    cellW = 5,
    cellH = 10,
    facePolicy = 'merge-then-grow',
    maxCols = DEFAULT_MAX_COLS,
  } = opts
  const { mergeIdentical } = POLICIES[facePolicy]
  // Widen the gap between node groups until every edge routes with right-angle crossings only.
  const render = (keep: number) => {
    for (let gap = 0; gap <= 8; gap++)
      for (const longestFirst of [false, true]) {
        const r = attempt(
          layout,
          cellW,
          cellH,
          mergeIdentical,
          gap,
          false,
          keep,
          longestFirst,
        )
        if (r) return r
      }
    return attempt(layout, cellW, cellH, mergeIdentical, 4, true, keep)!
  }
  const natural = render(1)
  const naturalCols = natural.stats.cols
  natural.stats.naturalCols = naturalCols
  if (naturalCols <= maxCols) return natural
  // Squeeze the blank gaps: find the largest kept fraction that fits and still routes cleanly.
  // Width is monotone in `keep` up to routing's own gap widening, so bisect.
  const fits = (r: RasterResult) => r.stats.cols <= maxCols && !r.stats.relaxed
  const floor = render(0)
  if (!fits(floor)) {
    natural.capped = false
    return natural
  }
  let best = floor
  let lo = 0
  let hi = 1
  for (let i = 0; i < 7; i++) {
    const mid = (lo + hi) / 2
    const r = render(mid)
    if (fits(r)) {
      best = r
      lo = mid
    } else hi = mid
  }
  best.stats.naturalCols = naturalCols
  return best
}
