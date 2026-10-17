/**
 * Reproduces mermaid 12.2's DEFAULT flowchart layout (ELK, not dagre) in plain Node, no
 * browser: rendering-util/layout-algorithms/elk/render.ts for flat graphs (no subgraphs): root
 * options, edge construction, and the edge-point post-processing (cutter2 endpoint attach,
 * marker-segment trimming, terminal-jog straightening).
 *
 * Must run on elkjs 0.9.3 (mermaid's own dependency): 0.11/0.12 lay the dense samples out
 * differently. This package pins it exactly and resolves it package-locally.
 */
import ELK from 'elkjs/lib/elk.bundled.js'
import { buildModel, inside, type MNode, type Model, type Pt } from './model.ts'

export interface LayoutNode {
  id: string
  x: number
  y: number
  w: number
  h: number
  label: string
}
export interface LayoutEdge {
  id: string
  from: string
  to: string
  pts: [number, number][]
  label?: string
  lw: number
  lh: number
}
/** x/y are node centres; edge `pts` run from the source outline to the target outline. */
export interface FlowchartLayout {
  dir: 'TD' | 'BT' | 'LR' | 'RL'
  nodes: LayoutNode[]
  edges: LayoutEdge[]
}

const DIR = { TB: 'DOWN', BT: 'UP', LR: 'RIGHT', RL: 'LEFT' } as const
const PORTS_SURROUNDING = '[top=12,left=12,bottom=12,right=12]'

// elk/render.ts createRootElkGraph(), preset "default", config.elk defaults, undefined entries dropped.
const rootOptions = (dir: Model['dir']) => ({
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.algorithm': 'elk.layered',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
  'elk.layered.mergeEdges': false,
  'elk.direction': DIR[dir],
  'spacing.baseValue': 40,
  'elk.layered.crossingMinimization.forceNodeModelOrder': false,
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.unnecessaryBendpoints': true,
  'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
  'elk.layered.layering.strategy': 'NETWORK_SIMPLEX',
  'elk.layered.layering.coffmanGraham.layerBound': 4,
  'elk.layered.wrapping.multiEdge.improveCuts': true,
  'elk.layered.wrapping.multiEdge.improveWrappedEdges': true,
  'elk.layered.edgeRouting.selfLoopDistribution': 'EQUALLY',
  'elk.layered.mergeHierarchyEdges': true,
  'elk.spacing.portsSurrounding': PORTS_SURROUNDING,
})

// ---- geometry (elk/geometry.ts + render.ts), specialised to non-group nodes ----
export type Box = { x: number; y: number; w: number; h: number } // centre + size
export const onBorder = (b: Box, p: Pt, tol = 0.5) => {
  const l = b.x - b.w / 2,
    r = b.x + b.w / 2,
    t = b.y - b.h / 2,
    bt = b.y + b.h / 2
  return (
    ((Math.abs(p.x - l) <= tol || Math.abs(p.x - r) <= tol) &&
      p.y >= t - tol &&
      p.y <= bt + tol) ||
    ((Math.abs(p.y - t) <= tol || Math.abs(p.y - bt) <= tol) &&
      p.x >= l - tol &&
      p.x <= r + tol)
  )
}
export const outsideNode = (b: Box, p: Pt) =>
  Math.abs(p.x - b.x) >= b.w / 2 || Math.abs(p.y - b.y) >= b.h / 2

/** outlineAttachPoint: slide along the edge's departure axis to the node outline (bisection). */
export function attach(n: MNode, b: Box, port: Pt, next: Pt): Pt | null {
  const dx = next.x - port.x,
    dy = next.y - port.y
  if ((dx === 0 && dy === 0) || (Math.abs(dx) > 1e-6 && Math.abs(dy) > 1e-6))
    return null
  const horiz = Math.abs(dx) > Math.abs(dy)
  const at = (t: number): Pt =>
    horiz ? { x: t, y: port.y } : { x: port.x, y: t }
  const inOutline = (p: Pt) => {
    const crossingDist = inside(n, p.x - b.x, p.y - b.y)
    return crossingDist
  }
  let inner = horiz ? b.x : b.y
  let outer = horiz ? port.x : port.y
  if (!inOutline(at(inner))) return null
  if (inOutline(at(outer))) return { ...port }
  for (let i = 0; i < 20; i++) {
    const mid = (inner + outer) / 2
    if (inOutline(at(mid))) inner = mid
    else outer = mid
  }
  return at(inner)
}

export function rectRay(b: Box, outside: Pt): Pt {
  // fallback intersection(): centre-ray to the box, good enough for rects
  const dx = outside.x - b.x,
    dy = outside.y - b.y
  const s = Math.min(
    dx ? b.w / 2 / Math.abs(dx) : Infinity,
    dy ? b.h / 2 / Math.abs(dy) : Infinity,
  )
  return { x: b.x + dx * s, y: b.y + dy * s }
}

export function replaceEndpoint(pts: Pt[], which: 'start' | 'end', v: Pt) {
  const i = which === 'start' ? 0 : pts.length - 1
  if (Math.abs(pts[i]!.x - v.x) < 0.1 && Math.abs(pts[i]!.y - v.y) < 0.1)
    pts.splice(i, 1)
  else pts[i] = v
}

export function cutter2(
  sn: MNode,
  en: MNode,
  sb: Box,
  eb: Box,
  orig: Pt[],
): Pt[] {
  const pts = [...orig]
  const si = pts.findIndex((p) => outsideNode(sb, p))
  if (si !== -1) {
    const a = pts[si + 1] ? attach(sn, sb, pts[si]!, pts[si + 1]!) : null
    replaceEndpoint(pts, 'start', a ?? rectRay(sb, pts[si]!))
  }
  let ei = -1
  for (let i = pts.length - 1; i >= 0; i--)
    if (outsideNode(eb, pts[i]!)) {
      ei = i
      break
    }
  if (ei === -1 && pts.length > 1) ei = pts.length - 2
  if (ei !== -1) {
    const a = pts[ei - 1] ? attach(en, eb, pts[ei]!, pts[ei - 1]!) : null
    replaceEndpoint(pts, 'end', a ?? rectRay(eb, pts[ei]!))
  }
  if (pts.length > 1) {
    const l = pts[pts.length - 1]!,
      s = pts[pts.length - 2]!
    if (Math.hypot(l.x - s.x, l.y - s.y) < 2) pts.pop()
  }
  return pts
}

const dedupe = (pts: Pt[]) =>
  pts.filter(
    (p, i) =>
      i === 0 ||
      Math.abs(p.x - pts[i - 1]!.x) > 1e-6 ||
      Math.abs(p.y - pts[i - 1]!.y) > 1e-6,
  )

const MARKER = 4 // arrow_point
export function trimMarkerSegments(
  pts: Pt[],
  sb: Box,
  eb: Box,
  arrowStart: boolean,
  arrowEnd: boolean,
): Pt[] {
  let p = pts
  if (arrowEnd && p.length >= 3) {
    const end = p[p.length - 1]!,
      entry = p[p.length - 2]!
    if (
      Math.hypot(end.x - entry.x, end.y - entry.y) < Math.max(8, MARKER * 2) &&
      onBorder(eb, entry, 1)
    )
      p = [...p.slice(0, -2), end]
  }
  if (arrowStart && p.length >= 3) {
    const [s, e] = [p[0]!, p[1]!]
    if (
      Math.hypot(e.x - s.x, e.y - s.y) < Math.max(8, MARKER * 2) &&
      onBorder(sb, e, 1)
    )
      p = [s, ...p.slice(2)]
  }
  return p
}

// ---- straightenEdgeTerminals (render.ts), ported without the label-cover tie-break ----
const axisOf = (a: Pt, b: Pt) => {
  const dx = Math.abs(b.x - a.x),
    dy = Math.abs(b.y - a.y)
  return dx > 0.01 && dy <= 0.01
    ? 'h'
    : dy > 0.01 && dx <= 0.01
      ? 'v'
      : undefined
}
export function straightenFront(pts: Pt[]): Pt[] | null {
  if (pts.length < 5) return null
  const [p0, p1, p2, p3] = pts as [Pt, Pt, Pt, Pt]
  const axis = axisOf(p0, p1)
  if (
    !axis ||
    axisOf(p2, p3) !== axis ||
    axisOf(p1, p2) !== (axis === 'h' ? 'v' : 'h')
  )
    return null
  if (Math.hypot(p1.x - p0.x, p1.y - p0.y) > 30) return null
  const jog = axis === 'h' ? Math.abs(p2.y - p1.y) : Math.abs(p2.x - p1.x)
  if (jog < 0.01 || jog > 16) return null
  const fwd =
    axis === 'h'
      ? Math.sign(p1.x - p0.x) === Math.sign(p3.x - p2.x)
      : Math.sign(p1.y - p0.y) === Math.sign(p3.y - p2.y)
  if (!fwd) return null
  let last = 3
  while (last + 1 < pts.length && axisOf(pts[last]!, pts[last + 1]!) === axis)
    last++
  if (last === pts.length - 1) return null
  const moved = [...pts]
  for (let i = 2; i <= last; i++)
    moved[i] =
      axis === 'h' ? { x: pts[i]!.x, y: p0.y } : { x: p0.x, y: pts[i]!.y }
  moved.splice(1, 2)
  return moved
}
const cross = (a1: Pt, a2: Pt, b1: Pt, b2: Pt) => {
  const side = (o: Pt, p: Pt, q: Pt) =>
    (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x)
  const [d1, d2, d3, d4] = [
    side(b1, b2, a1),
    side(b1, b2, a2),
    side(a1, a2, b1),
    side(a1, a2, b2),
  ]
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  )
}
const crossings = (a: Pt[], b: Pt[]) => {
  let n = 0
  for (let i = 0; i < a.length - 1; i++)
    for (let j = 0; j < b.length - 1; j++)
      n += +cross(a[i]!, a[i + 1]!, b[j]!, b[j + 1]!)
  return n
}
export function straighten(routes: Pt[][]) {
  routes.forEach((orig, idx) => {
    if (orig.length < 5) return
    let cand = straightenFront(orig) ?? orig
    const back = straightenFront([...cand].reverse())
    if (back) cand = back.reverse()
    if (cand === orig) return
    let before = 0,
      after = 0
    routes.forEach((r, o) => {
      if (o === idx || r.length < 2) return
      before += crossings(orig, r)
      after += crossings(cand, r)
    })
    if (after <= before) routes[idx] = cand
  })
}

/** Lay out flowchart source. Throws UnsupportedFlowchartError for shapes/features not modelled. */
export async function layoutFlowchart(src: string): Promise<FlowchartLayout> {
  const m = buildModel(src)
  const graph = {
    id: 'root',
    layoutOptions: rootOptions(m.dir) as unknown as Record<string, string>,
    children: m.nodes.map((n) => ({ id: n.id, width: n.w, height: n.h })),
    edges: m.edges.map((e) => ({
      id: e.id,
      sources: [e.from],
      targets: [e.to],
      labels: [
        {
          width: e.lw,
          height: e.lh,
          text: e.label ?? '',
          layoutOptions: {
            'edgeLabels.inline': 'true',
            'edgeLabels.placement': 'CENTER',
          },
        },
      ],
    })),
  }
  const res = await new ELK().layout(graph)
  const byId = new Map<string, { n: MNode; b: Box }>()
  for (const c of res.children!) {
    const n = m.nodes.find((x) => x.id === c.id)!
    const [x, y, w, h] = [c.x!, c.y!, c.width!, c.height!]
    byId.set(c.id, { n, b: { x: x + w / 2, y: y + h / 2, w, h } })
  }
  const edgeBy = new Map(m.edges.map((e) => [e.id, e]))
  const laidOut = res.edges!
  const routes = laidOut.map((re) => {
    const e = edgeBy.get(re.id)!
    const s = byId.get(e.from)!
    const t = byId.get(e.to)!
    const sec = re.sections![0]!
    let pts: Pt[] = [sec.startPoint, ...(sec.bendPoints ?? []), sec.endPoint]
    pts = [{ x: s.b.x, y: s.b.y }, ...pts, { x: t.b.x, y: t.b.y }]
    pts = dedupe(cutter2(s.n, t.n, s.b, t.b, pts))
    return trimMarkerSegments(pts, s.b, t.b, e.arrowStart, e.arrowEnd)
  })
  straighten(routes)
  return {
    dir: m.dir === 'TB' ? 'TD' : m.dir,
    nodes: m.nodes.map((n) => {
      const { b } = byId.get(n.id)!
      return { id: n.id, x: b.x, y: b.y, w: b.w, h: b.h, label: n.label }
    }),
    edges: laidOut.map((re, i) => {
      const e = edgeBy.get(re.id)!
      return {
        id: e.id,
        from: e.from,
        to: e.to,
        pts: routes[i]!.map((p) => [p.x, p.y] as [number, number]),
        label: e.label,
        lw: e.lw,
        lh: e.lh,
      }
    }),
  }
}
