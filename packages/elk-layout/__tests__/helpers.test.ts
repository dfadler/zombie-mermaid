import { describe, expect, it } from 'vitest'
import {
  attach,
  cutter2,
  layoutFlowchart,
  onBorder,
  outsideNode,
  rectRay,
  replaceEndpoint,
  straighten,
  straightenFront,
  trimMarkerSegments,
  type Box,
} from '../src/layout.ts'
import { buildModel, inside, type MNode, type Pt } from '../src/model.ts'

const box = (x = 0, y = 0): Box => ({ x, y, w: 100, h: 50 })
const rect = (b: Box): MNode => ({
  id: 'n',
  label: 'n',
  kind: 'rect',
  w: b.w,
  h: b.h,
})
const P = (x: number, y: number): Pt => ({ x, y })
const near = (p: Pt | null, x: number, y: number) => {
  expect(p).not.toBeNull()
  expect(p!.x).toBeCloseTo(x, 3)
  expect(p!.y).toBeCloseTo(y, 3)
}

describe('onBorder / outsideNode', () => {
  const b = box()
  it.each([
    [P(50, 0), true], // Right edge
    [P(-50, 10), true], // Left edge
    [P(10, -25), true], // Top edge
    [P(10, 25), true], // Bottom edge
    [P(0, 0), false], // Centre
    [P(50, 30), false], // On the right line but below the box
    [P(60, 25), false], // On the bottom line but right of the box
    [P(10, 60), false],
  ])('onBorder(%j) is %s', (p, want) => expect(onBorder(b, p)).toBe(want))

  it('honours the tolerance argument over the 0.5 default', () => {
    expect(onBorder(b, P(50.8, 0))).toBe(false)
    expect(onBorder(b, P(50.8, 0), 1)).toBe(true)
  })
  it('outsideNode is true once either axis reaches the half-extent', () => {
    expect(outsideNode(b, P(50, 0))).toBe(true)
    expect(outsideNode(b, P(0, 25))).toBe(true)
    expect(outsideNode(b, P(49, 24))).toBe(false)
  })
})

describe('attach', () => {
  const b = box()
  const n = rect(b)
  it('refuses a zero-length or diagonal departure', () => {
    expect(attach(n, b, P(60, 0), P(60, 0))).toBeNull()
    expect(attach(n, b, P(60, 0), P(0, 10))).toBeNull()
  })
  it('bisects to the outline along a horizontal departure', () => {
    near(attach(n, b, P(80, 0), P(0, 0)), 50, 0)
    near(attach(n, b, P(-80, 10), P(0, 10)), -50, 10)
  })
  it('bisects to the outline along a vertical departure', () => {
    near(attach(n, b, P(0, 60), P(0, 0)), 0, 25)
  })
  it('returns null when the node centre line misses the node', () => {
    expect(attach(n, b, P(80, 40), P(0, 40))).toBeNull()
  })
  it('keeps a port that is already inside the outline', () => {
    near(attach(n, b, P(30, 0), P(0, 0)), 30, 0)
  })
  it('uses the diamond outline, not its bounding box', () => {
    const d: MNode = { ...n, kind: 'diamond', w: 100, h: 100 }
    const db: Box = { x: 0, y: 0, w: 100, h: 100 }
    near(attach(d, db, P(80, 0), P(0, 0)), 50, 0)
    expect(inside(d, 40, 40)).toBe(false)
    expect(inside(n, 40, 20)).toBe(true)
  })
})

describe('rectRay / replaceEndpoint', () => {
  const b = box()
  it('projects the centre ray onto the rectangle', () => {
    near(rectRay(b, P(100, 0)), 50, 0) // Dy = 0
    near(rectRay(b, P(0, 100)), 0, 25) // Dx = 0
    near(rectRay(b, P(100, 100)), 25, 25) // Diagonal: the 25-tall side wins
  })
  it('replaces an endpoint, or drops it when the new one coincides', () => {
    const a = [P(0, 0), P(10, 0), P(20, 0)]
    replaceEndpoint(a, 'start', P(1, 0))
    expect(a[0]).toEqual(P(1, 0))
    replaceEndpoint(a, 'end', P(25, 0))
    expect(a[2]).toEqual(P(25, 0))
    replaceEndpoint(a, 'end', P(25.05, 0))
    expect(a).toHaveLength(2)
    replaceEndpoint(a, 'start', P(1.05, 0))
    expect(a).toEqual([P(10, 0)])
  })
})

describe('cutter2', () => {
  const sb = box(0, 0)
  const eb = box(200, 0)
  const run = (pts: Pt[], s = sb, e = eb) =>
    cutter2(rect(s), rect(e), s, e, pts)

  it('clips both ends to the node outlines', () => {
    const r = run([P(0, 0), P(60, 0), P(140, 0), P(200, 0)])
    expect(r.map((p) => [Math.round(p.x), p.y])).toEqual([
      [50, 0],
      [60, 0],
      [140, 0],
      [150, 0],
    ])
  })
  it('works when no point leaves the source node', () => {
    const r = run([P(0, 0), P(10, 0)])
    expect(r.at(-1)!.x).toBeCloseTo(150, 2)
  })
  it('falls back to the second-to-last point when nothing is outside the target', () => {
    const r = run([P(0, 0), P(10, 0), P(0, 0)], sb, sb)
    expect(r).toEqual([P(0, 0), P(10, 0)])
  })
  it('leaves a lone point inside both nodes untouched', () => {
    expect(run([P(0, 0)], sb, sb)).toEqual([P(0, 0)])
  })
  it('uses the rectangle ray for a single stray point', () => {
    expect(run([P(300, 0)])).toHaveLength(1)
  })
  it('drops a final segment shorter than 2px', () => {
    const r = run([P(0, 0), P(60, 0), P(149, 0), P(200, 0)])
    expect(r.at(-1)).toEqual(P(149, 0))
  })
  it('splices a start that already sits on the outline', () => {
    const r = run([P(50, 0), P(60, 0), P(140, 0), P(200, 0)])
    expect(r[0]).toEqual(P(60, 0))
  })
})

describe('trimMarkerSegments', () => {
  const sb = box(0, 0)
  const eb = box(200, 0)
  // End marker: entry sits on the target border, < 8px before the end
  const endPts = [P(50, 0), P(100, 10), P(150, 5), P(150, 0)]
  it('drops the marker entry point at the target end', () => {
    expect(trimMarkerSegments(endPts, sb, eb, false, true)).toEqual([
      P(50, 0),
      P(100, 10),
      P(150, 0),
    ])
  })
  it('keeps it without an end arrow, with a long final segment, or off the border', () => {
    expect(trimMarkerSegments(endPts, sb, eb, false, false)).toEqual(endPts)
    const far = [P(50, 0), P(100, 10), P(150, -15), P(150, 0)]
    expect(trimMarkerSegments(far, sb, eb, false, true)).toEqual(far)
    const off = [P(50, 0), P(100, 10), P(140, 0), P(144, 0)]
    expect(trimMarkerSegments(off, sb, eb, false, true)).toEqual(off)
  })
  it('drops the marker entry point at the source end', () => {
    const pts = [P(50, 0), P(50, 5), P(100, 10), P(150, 0)]
    expect(trimMarkerSegments(pts, sb, eb, true, false)).toEqual([
      P(50, 0),
      P(100, 10),
      P(150, 0),
    ])
    expect(trimMarkerSegments(pts, sb, eb, false, false)).toEqual(pts)
    const far = [P(50, 0), P(50, 20), P(100, 10), P(150, 0)]
    expect(trimMarkerSegments(far, sb, eb, true, false)).toEqual(far)
    const off = [P(30, 0), P(34, 0), P(100, 10), P(150, 0)]
    expect(trimMarkerSegments(off, sb, eb, true, false)).toEqual(off)
  })
  it('leaves two-point routes alone', () => {
    const two = [P(50, 0), P(150, 0)]
    expect(trimMarkerSegments(two, sb, eb, true, true)).toEqual(two)
  })
})

describe('straightenFront / straighten', () => {
  const h = [P(0, 0), P(10, 0), P(10, 5), P(30, 5), P(30, 50)]
  const v = [P(0, 0), P(0, 10), P(5, 10), P(5, 30), P(50, 30)]
  it('removes a short horizontal-start jog', () => {
    expect(straightenFront(h)).toEqual([P(0, 0), P(30, 0), P(30, 50)])
  })
  it('removes a short vertical-start jog', () => {
    expect(straightenFront(v)).toEqual([P(0, 0), P(0, 30), P(50, 30)])
  })
  it.each([
    ['too few points', h.slice(0, 4)],
    [
      'diagonal first segment',
      [P(0, 0), P(10, 5), P(10, 10), P(30, 10), P(30, 50)],
    ],
    [
      'second leg on another axis',
      [P(0, 0), P(10, 0), P(10, 5), P(30, 8), P(30, 50)],
    ],
    [
      'no perpendicular jog',
      [P(0, 0), P(10, 0), P(20, 0), P(30, 0), P(30, 50)],
    ],
    ['first leg too long', [P(0, 0), P(40, 0), P(40, 5), P(60, 5), P(60, 50)]],
    ['jog too big', [P(0, 0), P(10, 0), P(10, 20), P(30, 20), P(30, 50)]],
    ['backtracking', [P(0, 0), P(10, 0), P(10, 5), P(-20, 5), P(-20, 50)]],
    [
      'backtracking vertically',
      [P(0, 0), P(0, 10), P(5, 10), P(5, -20), P(50, -20)],
    ],
    [
      'nothing after the run',
      [P(0, 0), P(10, 0), P(10, 5), P(30, 5), P(50, 5)],
    ],
  ])('returns null for %s', (_n, pts) =>
    expect(straightenFront(pts)).toBeNull(),
  )

  it('straightens either end of a route in place', () => {
    const fwd = [...h]
    const back = [...h].reverse()
    const short = [P(0, 0), P(1, 1)]
    const routes = [fwd, back, short]
    straighten(routes)
    expect(routes[0]).toEqual([P(0, 0), P(30, 0), P(30, 50)])
    expect(routes[1]).toEqual([P(30, 50), P(30, 0), P(0, 0)])
    expect(routes[2]).toBe(short)
  })
  it('skips routes that cannot be straightened', () => {
    const r = [P(0, 0), P(10, 5), P(10, 10), P(30, 10), P(30, 50)]
    const routes = [r]
    straighten(routes)
    expect(routes[0]).toBe(r)
  })
  it('keeps the original when straightening would add a crossing', () => {
    const blocker = [P(20, -3), P(20, 2)]
    const stub = [P(1, 1)]
    const routes = [[...h], blocker, stub]
    straighten(routes)
    expect(routes[0]).toEqual(h)
  })
  it('takes the straightened route when it removes a crossing', () => {
    const blocker = [P(20, 2), P(20, 10)]
    const routes = [[...h], blocker]
    straighten(routes)
    expect(routes[0]).toEqual([P(0, 0), P(30, 0), P(30, 50)])
  })
})

describe('layoutFlowchart whole-graph edge cases', () => {
  it.each(['TD', 'BT', 'LR', 'RL'] as const)('direction %s', async (d) => {
    const l = await layoutFlowchart(`flowchart ${d}\n  A --> B --> C`)
    expect(l.dir).toBe(d)
    const [a, , c] = l.nodes
    const horizontal = d === 'LR' || d === 'RL'
    const delta = horizontal ? c!.x - a!.x : c!.y - a!.y
    expect(Math.sign(delta)).toBe(d === 'TD' || d === 'LR' ? 1 : -1)
  })
  it('lays out a single node with no edges', async () => {
    const l = await layoutFlowchart('flowchart TD\n  A[Only]')
    expect(l.nodes).toHaveLength(1)
    expect(l.edges).toEqual([])
  })
  it('lays out an empty graph', async () => {
    const l = await layoutFlowchart('flowchart TD')
    expect(l.nodes).toEqual([])
    expect(l.edges).toEqual([])
  })
  it('labels edges, wraps long labels and numbers parallel edges', async () => {
    const long =
      'a very long edge label that must wrap past two hundred px of text'
    const l = await layoutFlowchart(
      `flowchart TD\n  A -->|${long}| B\n  A --> B\n  A --> B\n  A ~~~ C`,
    )
    expect(l.edges.map((e) => e.id).slice(0, 3)).toEqual([
      'L_A_B_0',
      'L_A_B_2',
      'L_A_B_3',
    ])
    const labelled = l.edges.find((e) => e.label === long)!
    expect(labelled.lh).toBe(24)
    expect(labelled.lw).toBeLessThanOrEqual(200)
    const plain = l.edges.find((e) => e.id === 'L_A_B_2')!
    expect([plain.label, plain.lw, plain.lh]).toEqual([undefined, 0, 0])
  })
  it('measures characters outside the ASCII advance table', () => {
    const ascii = buildModel('flowchart TD\n  A[ok]').nodes[0]!
    const wide = buildModel('flowchart TD\n  A[' + 'é世界'.repeat(12) + ']')
      .nodes[0]!
    expect(wide.w).toBeGreaterThan(ascii.w)
  })
})
