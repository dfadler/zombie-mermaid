/**
 * `layout: 'simple'` (#1685): the built-in layered layout for flowcharts.
 * Opt-in, never a fallback, and it must not need `elkjs`.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { PositionedGraph } from '@zombie-mermaid/core'
import { samples } from '../../../site/samples-data.ts'
import { layered } from '../layout-engine/layered.ts'
import { layoutFlowchartSync, renderMermaidSVG } from '../index.ts'
import { parseMermaid } from '../../../../src/index.ts'

const lay = (source: string, direction?: string): PositionedGraph => {
  const graph = parseMermaid(source)
  return layoutFlowchartSync(
    direction ? { ...graph, direction: direction as never } : graph,
    { layout: 'simple' },
  )
}
const node = (g: PositionedGraph, id: string) =>
  g.nodes.find((n) => n.id === id)!
const overlaps = (
  a: { x: number; y: number; width: number; height: number },
  b: typeof a,
): boolean =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height

afterEach(() => vi.restoreAllMocks())

describe('layout: simple needs no elkjs', () => {
  it('renders a flowchart with elkjs unavailable, while the default still throws', async () => {
    vi.resetModules()
    vi.spyOn(process, 'getBuiltinModule').mockImplementation(() => undefined)
    const api = await import('../index.ts')
    const src = 'graph TD\n  A --> B'
    expect(() => api.renderMermaidSVG(src)).toThrow(api.ElkNotRegisteredError)
    expect(api.renderMermaidSVG(src, { layout: 'simple' })).toContain('</svg>')
    // Opt-in only: other graph diagrams ignore it and still need elkjs.
    expect(() =>
      api.renderMermaidSVG('stateDiagram-v2\n  [*] --> A', {
        layout: 'simple',
      }),
    ).toThrow(api.ElkNotRegisteredError)
  })

  it("leaves default output unchanged: no option and layout: 'elk' are identical", () => {
    const src = 'graph TD\n  A -->|x| B\n  B --> C'
    expect(renderMermaidSVG(src, { layout: 'elk' })).toBe(renderMermaidSVG(src))
  })

  it('rejects an unknown engine name', () => {
    expect(() =>
      renderMermaidSVG('graph TD\n  A --> B', { layout: 'dagre' as never }),
    ).toThrow(/unknown layout "dagre"/)
  })

  it('is deterministic', () => {
    const src = 'graph LR\n  A --> B & C\n  B --> D\n  C --> D\n  D --> A'
    expect(renderMermaidSVG(src, { layout: 'simple' })).toBe(
      renderMermaidSVG(src, { layout: 'simple' }),
    )
  })
})

describe('layout: simple geometry', () => {
  it.each([
    ['TD', 'y', 1],
    ['TB', 'y', 1],
    ['BT', 'y', -1],
    ['LR', 'x', 1],
    ['RL', 'x', -1],
  ] as const)('flows %s', (dir, axis, sign) => {
    const g = lay(`graph ${dir}\n  A --> B --> C`)
    const [a, b, c] = ['A', 'B', 'C'].map((id) => node(g, id)[axis])
    expect(Math.sign(b! - a!)).toBe(sign)
    expect(Math.sign(c! - b!)).toBe(sign)
    // The edge runs from A's side to B's side, in source to target order.
    const e = g.edges.find((e) => e.source === 'A')!
    expect(Math.sign(e.points.at(-1)![axis] - e.points[0]![axis])).toBe(sign)
  })

  it('draws the edge a cycle closes as feedback, still source to target', () => {
    const g = lay('graph TD\n  A --> B\n  B --> C\n  C --> A')
    expect(node(g, 'C').y).toBeGreaterThan(node(g, 'A').y)
    const back = g.edges.find((e) => e.source === 'C' && e.target === 'A')!
    expect(back.points[0]!.y).toBeLessThan(node(g, 'C').y + 1)
    expect(back.points[0]!.y).toBeGreaterThan(node(g, 'C').y - 1)
    expect(back.points.at(-1)!.y).toBeCloseTo(
      node(g, 'A').y + node(g, 'A').height,
    )
  })

  it('draws a self-loop beside the node, with room reserved for it', () => {
    const g = lay('graph TD\n  P --> A\n  P --> X\n  A -->|again| A')
    const loop = g.edges.find((e) => e.source === 'A' && e.target === 'A')!
    const a = node(g, 'A')
    const loopRight = Math.max(...loop.points.map((p) => p.x))
    expect(loopRight).toBeGreaterThan(a.x + a.width)
    expect(loop.labelPosition).toBeDefined()
    // X shares A's rank, to its right: the loop does not run into it.
    expect(node(g, 'X').x).toBeGreaterThan(loopRight)
  })

  it('keeps self-loops of a horizontal graph, and stacks several', () => {
    const g = lay('graph LR\n  A --> A\n  A --> A\n  A --> B')
    expect(
      g.edges.filter((e) => e.source === 'A' && e.target === 'A'),
    ).toHaveLength(2)
  })

  it('gives parallel edges their own routes', () => {
    const g = lay('graph TD\n  A --> B\n  A --> B\n  A --> B')
    const routes = g.edges.map((e) => JSON.stringify(e.points))
    expect(new Set(routes).size).toBe(3)
  })

  it('places edge labels clear of every node', () => {
    const g = lay(
      'graph TD\n  A -->|a fairly long edge label indeed| B\n  A -->|no| C\n  B --> D\n  C --> D',
    )
    for (const e of g.edges.filter((e) => e.label)) {
      const p = e.labelPosition!
      const box = { x: p.x - 4, y: p.y - 4, width: 8, height: 8 }
      for (const n of g.nodes) expect(overlaps(box, n)).toBe(false)
    }
  })

  it('makes room for a wide label between ranks of a horizontal graph', () => {
    const narrow = lay('graph LR\n  A -->|x| B')
    const wide = lay(
      'graph LR\n  A -->|a really quite wide label to fit between| B',
    )
    expect(node(wide, 'B').x - node(wide, 'A').x).toBeGreaterThan(
      node(narrow, 'B').x - node(narrow, 'A').x + 100,
    )
  })

  it('keeps disconnected components apart, in source order', () => {
    const g = lay('graph TD\n  A --> B\n  X --> Y\n  Z')
    expect(g.nodes).toHaveLength(5)
    for (const a of g.nodes) {
      for (const b of g.nodes) if (a !== b) expect(overlaps(a, b)).toBe(false)
    }
    expect(node(g, 'X').x).toBeGreaterThan(node(g, 'A').x)
    expect(node(g, 'Z').x).toBeGreaterThan(node(g, 'X').x)
  })

  it('reduces crossings: sweeping reorders a rank the first pass left crossed', () => {
    const box = { axis: 10, cross: 10 }
    // Depth-first order puts node 2 before node 3, which crosses 0->3 over
    // 1->2. Found by search: without the sweeps this graph has one crossing.
    const r = layered(
      [box, box, box, box],
      [
        { from: 0, to: 3 },
        { from: 1, to: 2 },
        { from: 1, to: 3 },
      ],
      { nodeSep: 10, rankSep: 10 },
    )
    expect(r.nodes[3]!.cross).toBeLessThan(r.nodes[2]!.cross)
    // 1->3 runs left of 1->2 on the rank between, so the two do not cross.
    expect(r.paths[2]![0]!.cross).toBeLessThan(r.paths[1]![0]!.cross)
  })

  it('handles an empty input and a lone node', () => {
    const o = { nodeSep: 10, rankSep: 10 }
    expect(layered([], [], o)).toMatchObject({ axisSize: 0, crossSize: 0 })
    expect(layered([{ axis: 4, cross: 6 }], [], o)).toMatchObject({
      axisSize: 4,
      crossSize: 6,
    })
  })

  it('routes a long edge around the node it skips', () => {
    const g = lay('graph TD\n  A --> B --> C\n  A --> C')
    const long = g.edges.find((e) => e.source === 'A' && e.target === 'C')!
    expect(long.points.length).toBeGreaterThan(2)
    expect(
      long.points.every(
        (p) => !overlaps({ ...p, width: 0.5, height: 0.5 }, node(g, 'B')),
      ),
    ).toBe(true)
  })
})

describe('layout: simple subgraphs', () => {
  const src = `graph TD
  X --> S
  subgraph S [A wide enough subgraph title]
    a --> b
    subgraph T
      c
    end
    b --> c
  end
  b --> Y
  c --> Y
  Y --> Z`

  it.each(['TD', 'BT', 'LR', 'RL'])(
    'boxes members inside their group, nested, in %s',
    (dir) => {
      const g = lay(src, dir)
      const [s] = g.groups
      expect(s!.id).toBe('S')
      expect(s!.children.map((c) => c.id)).toEqual(['T'])
      const inside = (
        n: { x: number; y: number; width: number; height: number },
        o: typeof n,
      ) =>
        n.x >= o.x &&
        n.y >= o.y &&
        n.x + n.width <= o.x + o.width &&
        n.y + n.height <= o.y + o.height
      for (const id of ['a', 'b']) expect(inside(node(g, id), s!)).toBe(true)
      expect(inside(node(g, 'c'), s!.children[0]!)).toBe(true)
      expect(inside(s!.children[0]!, s!)).toBe(true)
      for (const id of ['X', 'Y', 'Z']) {
        expect(overlaps(node(g, id), s!)).toBe(false)
      }
      expect(s!.width).toBeGreaterThan(100)
    },
  )

  it('draws an edge to a subgraph id to its box, and skips an edge inside its own subgraph', () => {
    const g = lay(src)
    const toBox = g.edges.find((e) => e.source === 'X' && e.target === 'S')!
    expect(toBox.points.at(-1)!.y).toBeCloseTo(g.groups[0]!.y)
    const own = lay('graph TD\n  subgraph S\n    a\n  end\n  a --> S')
    expect(own.edges).toHaveLength(0)
  })

  it('keeps the title bar on top when the graph is flipped', () => {
    const g = lay('graph BT\n  subgraph S\n    a --> b\n  end', 'BT')
    const s = g.groups[0]!
    expect(node(g, 'a').y).toBeLessThan(s.y + s.height)
    // 44px of room above the topmost node (b, the last rank) for the title.
    expect(node(g, 'b').y - s.y).toBeGreaterThanOrEqual(44)
  })

  it('lays out an empty subgraph and a self-loop on a subgraph', () => {
    const g = lay('graph TD\n  subgraph E [Empty]\n  end\n  A --> A')
    expect(g.groups[0]!.width).toBeGreaterThan(0)
    const edge = lay('graph TD\n  subgraph S\n    a\n  end\n  S --> S')
    expect(edge.edges).toHaveLength(0)
  })

  it('keeps a state-style region flag on its group', () => {
    const graph = parseMermaid('graph TD\n  subgraph S\n    a\n  end')
    graph.subgraphs[0]!.region = true
    const g = layoutFlowchartSync(graph, { layout: 'simple' })
    expect(g.groups[0]!.region).toBe(true)
  })
})

describe('layout: simple over every flowchart sample', () => {
  const flowcharts = samples.filter((s) =>
    /^\s*(graph|flowchart)\b/.test(s.source),
  )

  it('finds the samples', () => {
    expect(flowcharts.length).toBeGreaterThan(20)
  })

  it.each(flowcharts.map((s) => [s.title, s.source] as const))(
    '%s: no overlapping nodes, finite geometry, edges attached to their nodes',
    (_title, source) => {
      const g = layoutFlowchartSync(parseMermaid(source), { layout: 'simple' })
      for (let i = 0; i < g.nodes.length; i++) {
        for (let j = i + 1; j < g.nodes.length; j++) {
          expect(overlaps(g.nodes[i]!, g.nodes[j]!)).toBe(false)
        }
      }
      for (const n of g.nodes) {
        expect(n.x).toBeGreaterThanOrEqual(0)
        expect(n.y).toBeGreaterThanOrEqual(0)
        expect(n.x + n.width).toBeLessThanOrEqual(g.width)
        expect(n.y + n.height).toBeLessThanOrEqual(g.height)
      }
      for (const e of g.edges) {
        for (const p of e.points) {
          expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
        }
        const s = g.nodes.find((n) => n.id === e.source)
        const t = g.nodes.find((n) => n.id === e.target)
        const near = (n: typeof s, p: { x: number; y: number }) =>
          !n ||
          (p.x >= n.x - 1 &&
            p.x <= n.x + n.width + 1 &&
            p.y >= n.y - 1 &&
            p.y <= n.y + n.height + 1)
        if (e.source !== e.target) {
          expect(near(s, e.points[0]!)).toBe(true)
          expect(near(t, e.points.at(-1)!)).toBe(true)
        }
      }
      // And it renders.
      expect(renderMermaidSVG(source, { layout: 'simple' })).toContain('</svg>')
    },
  )
})
