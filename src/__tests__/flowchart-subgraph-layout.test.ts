/**
 * #1239: flowcharts with subgraphs are laid out the way mermaid@12.3.0 lays
 * them out (one ELK pass over the whole hierarchy, see `usesMermaidElkPipeline`
 * in packages/svg-renderer/src/layout-engine/to-elk.ts). These tests pin the
 * resulting arrangements and that boxes, nodes and edges stay clear of each other.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid, renderMermaidSVG } from '../index.ts'
import {
  layoutFlowchartSync,
  layoutGraphSync,
} from '@zombie-mermaid/svg-renderer'
import { clearBorders } from '../../packages/svg-renderer/src/layout-engine/clear-borders.ts'
import { measureMultilineText } from '@zombie-mermaid/core'
import {
  FONT_SIZES,
  FONT_WEIGHTS,
} from '../../packages/svg-renderer/src/styles.ts'
import type {
  Direction,
  MermaidGraph,
  PositionedEdge,
  PositionedNode,
  MermaidSubgraph,
  PositionedGraph,
  PositionedGroup,
} from '@zombie-mermaid/core'

const CI_CD = `graph TD
  subgraph ci [CI Pipeline]
    A[Push Code] --> B{Tests Pass?}
    B -->|Yes| C[Build Image]
    B -->|No| D[Fix & Retry]
    D -.-> A
  end
  C --> E([Deploy Staging])
  E --> F{QA Approved?}
  F -->|Yes| G((Production))
  F -->|No| D`

const graphOf = (source: string): MermaidGraph =>
  parseMermaid(source) as MermaidGraph

const flattenGroups = (gs: PositionedGroup[]): PositionedGroup[] =>
  gs.flatMap((g) => [g, ...flattenGroups(g.children)])

/** Every node id in a parsed subgraph, including nested ones. */
const membersOf = (s: MermaidSubgraph): Set<string> => {
  const out = new Set(s.nodeIds)
  for (const c of s.children) for (const id of membersOf(c)) out.add(id)
  return out
}

const intersects = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y

/** No node that isn't a member overlaps a box, and no two unrelated boxes overlap. */
function expectBoxesClear(source: string, p: PositionedGraph): void {
  const g = graphOf(source)
  const all = (list: MermaidSubgraph[]): MermaidSubgraph[] =>
    list.flatMap((s) => [s, ...all(s.children)])
  const groups = new Map(flattenGroups(p.groups).map((q) => [q.id, q]))
  for (const s of all(g.subgraphs)) {
    const group = groups.get(s.id)!
    const inside = membersOf(s)
    for (const n of p.nodes) {
      if (inside.has(n.id)) {
        // A member is inside its box.
        expect(n.x, `${n.id} inside ${s.id}`).toBeGreaterThanOrEqual(group.x)
        expect(n.y).toBeGreaterThanOrEqual(group.y)
        expect(n.x + n.width).toBeLessThanOrEqual(group.x + group.width)
        expect(n.y + n.height).toBeLessThanOrEqual(group.y + group.height)
      } else {
        expect(intersects(n, group), `${n.id} overlaps ${s.id}`).toBe(false)
      }
    }
  }
  const list = [...groups.values()]
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!
      const b = list[j]!
      const nested =
        flattenGroups(a.children).includes(b) ||
        flattenGroups(b.children).includes(a)
      if (!nested)
        expect(intersects(a, b), `${a.id} overlaps ${b.id}`).toBe(false)
    }
  }
}

describe('layoutFlowchartSync: the CI/CD sample', () => {
  const p = layoutFlowchartSync(graphOf(CI_CD))
  const ci = p.groups[0]!
  const node = (id: string) => p.nodes.find((n) => n.id === id)!

  it('keeps every node that is not in the pipeline clear of its box', () => {
    expectBoxesClear(CI_CD, p)
  })

  it('puts Deploy Staging, QA Approved? and Production below the box', () => {
    for (const id of ['E', 'F', 'G']) {
      expect(node(id).y, id).toBeGreaterThanOrEqual(ci.y + ci.height)
    }
  })

  // `F --> D` is the feedback edge (#1993), as in mermaid 12.1.0 and 12.2.0
  // (ELK `orientFeedbackEdges`), so Fix & Retry sits beside Build Image.
  it('puts Fix & Retry level with Build Image, not after QA Approved?', () => {
    expect(node('D').y).toBe(node('C').y)
    expect(node('D').x).toBeGreaterThan(node('C').x + node('C').width)
  })

  it('flows top to bottom through the chain', () => {
    const ys = ['A', 'B', 'C', 'E', 'F', 'G'].map((id) => node(id).y)
    expect([...ys].sort((a, b) => a - b)).toEqual(ys)
  })

  it('has the box around Push Code, Tests Pass?, Build Image and Fix & Retry', () => {
    expect(ci.label).toBe('CI Pipeline')
    for (const id of ['A', 'B', 'C', 'D']) {
      expect(node(id).x).toBeGreaterThanOrEqual(ci.x)
      expect(node(id).x + node(id).width).toBeLessThanOrEqual(ci.x + ci.width)
    }
  })
})

describe('layoutFlowchartSync: edges inside a box stay inside it', () => {
  const p = layoutFlowchartSync(graphOf(CI_CD))
  const ci = p.groups[0]!
  const edge = (source: string, target: string) =>
    p.edges.find((e) => e.source === source && e.target === target)!

  it.each([
    ['B', 'D'],
    ['D', 'A'],
  ])('draws %s to %s within the box, not round the outside of it', (a, b) => {
    for (const pt of edge(a, b).points) {
      expect(pt.x).toBeGreaterThanOrEqual(ci.x)
      expect(pt.x).toBeLessThanOrEqual(ci.x + ci.width)
    }
  })

  it('does not run any edge through a node it does not join', () => {
    for (const e of p.edges) {
      for (let i = 1; i < e.points.length; i++) {
        const a = e.points[i - 1]!
        const b = e.points[i]!
        const seg = {
          x: Math.min(a.x, b.x),
          y: Math.min(a.y, b.y),
          width: Math.abs(a.x - b.x),
          height: Math.abs(a.y - b.y),
        }
        for (const n of p.nodes) {
          if (n.id === e.source || n.id === e.target) continue
          expect(intersects(seg, n), `${e.source}->${e.target} / ${n.id}`).toBe(
            false,
          )
        }
      }
    }
  })

  it('leaves the canvas no wider than the column beside the box and the box', () => {
    const columnRight = Math.max(
      ...['E', 'F', 'G'].map((id) => {
        const n = p.nodes.find((q) => q.id === id)!
        return n.x + n.width
      }),
    )
    expect(p.width).toBeLessThan(ci.x + ci.width + columnRight / 2)
  })

  it('keeps the two inside edges apart where they run side by side', () => {
    // Vertical runs as [x, top, bottom]; only runs sharing some height can touch.
    const runs = (a: string, b: string) =>
      edge(a, b).points.flatMap((pt, i, all) =>
        i > 0 && all[i - 1]!.x === pt.x
          ? [
              [
                pt.x,
                Math.min(pt.y, all[i - 1]!.y),
                Math.max(pt.y, all[i - 1]!.y),
              ],
            ]
          : [],
      ) as Array<[number, number, number]>
    for (const [x, top, bottom] of runs('B', 'D'))
      for (const [x2, top2, bottom2] of runs('D', 'A'))
        if (top < bottom2 && top2 < bottom)
          expect(Math.abs(x - x2)).toBeGreaterThan(12)
  })

  it('labels the edge on its own path', () => {
    const e = edge('B', 'D')
    expect(e.label).toBe('No')
    expect(e.points).toContainEqual(
      expect.objectContaining({ x: expect.any(Number) }),
    )
    // On the edge's own path (ELK places it, so not at `labelSpot`).
    const { x, y } = e.labelPosition!
    const onPath = e.points.some((pt, i, all) => {
      const q = all[i - 1]
      return (
        q !== undefined &&
        x >= Math.min(pt.x, q.x) - 1 &&
        x <= Math.max(pt.x, q.x) + 1 &&
        y >= Math.min(pt.y, q.y) - 1 &&
        y <= Math.max(pt.y, q.y) + 1
      )
    })
    expect(onPath).toBe(true)
  })
})

describe('layoutFlowchartSync: room between boxes does not stretch the boxes', () => {
  const SUBGRAPHS = `graph TD
  subgraph Frontend
    A[React App] --> B[State Manager]
  end
  subgraph Backend
    C[API Server] --> D[Database]
  end
  B --> C`
  const gap = (p: PositionedGraph, a: string, b: string): number => {
    const n = (id: string) => p.nodes.find((q) => q.id === id)!
    return n(b).y - (n(a).y + n(a).height)
  }
  const g = graphOf(SUBGRAPHS)
  const nested = layoutGraphSync(g)
  const flat = layoutFlowchartSync(g)

  it('keeps the gap inside a box as small as the nested layout has it', () => {
    expect(gap(flat, 'A', 'B')).toBeLessThanOrEqual(gap(nested, 'A', 'B') + 2)
    expect(gap(flat, 'C', 'D')).toBeLessThanOrEqual(gap(nested, 'C', 'D') + 2)
  })

  it('still keeps the two boxes clear of each other', () => {
    expectBoxesClear(SUBGRAPHS, flat)
  })
})

describe('layoutFlowchartSync: edges stay joined to their nodes after room is opened', () => {
  const SAMPLES = [
    ['CI/CD', CI_CD],
    [
      'Nested Subgraphs',
      'graph TD\n  subgraph Cloud\n    subgraph us-east [US East Region]\n      A[Web Server] --> B[App Server]\n    end\n    subgraph us-west [US West Region]\n      C[Web Server] --> D[App Server]\n    end\n  end\n  E[Load Balancer] --> A\n  E --> C',
    ],
    [
      'Subgraphs',
      'graph TD\n  subgraph Frontend\n    A[React App] --> B[State Manager]\n  end\n  subgraph Backend\n    C[API Server] --> D[Database]\n  end\n  B --> C',
    ],
  ] as const

  const onBoundary = (
    pt: { x: number; y: number },
    n: PositionedNode,
  ): boolean => {
    // A diamond's edges meet its slopes, not its bounding box.
    if (n.shape === 'diamond') return true
    const tol = 1.5
    const inside =
      pt.x > n.x + tol &&
      pt.x < n.x + n.width - tol &&
      pt.y > n.y + tol &&
      pt.y < n.y + n.height - tol
    const near =
      pt.x >= n.x - tol &&
      pt.x <= n.x + n.width + tol &&
      pt.y >= n.y - tol &&
      pt.y <= n.y + n.height + tol
    return near && !inside
  }

  it.each(SAMPLES)(
    '%s: every edge starts on its source and ends on its target',
    (_, source) => {
      const p = layoutFlowchartSync(graphOf(source))
      for (const e of p.edges) {
        const s = p.nodes.find((n) => n.id === e.source)!
        const t = p.nodes.find((n) => n.id === e.target)!
        expect(onBoundary(e.points[0]!, s), `${e.source} start`).toBe(true)
        expect(
          onBoundary(e.points[e.points.length - 1]!, t),
          `${e.target} end`,
        ).toBe(true)
      }
    },
  )
})

describe('layoutFlowchartSync: nothing of the scaffolding is left', () => {
  it('has exactly the nodes and edges of the source', () => {
    const g = graphOf(CI_CD)
    const p = layoutFlowchartSync(g)
    expect(p.nodes.map((n) => n.id).sort()).toEqual([...g.nodes.keys()].sort())
    expect(p.edges).toHaveLength(g.edges.length)
    for (const e of p.edges) {
      expect(g.nodes.has(e.source)).toBe(true)
      expect(g.nodes.has(e.target)).toBe(true)
    }
  })

  it('does not put a spine node into the rendered SVG', () => {
    expect(renderMermaidSVG(CI_CD)).not.toContain('__zm_spine__')
  })

  it('keeps a canvas that holds everything', () => {
    const p = layoutFlowchartSync(graphOf(CI_CD))
    for (const n of p.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0)
      expect(n.y).toBeGreaterThanOrEqual(0)
      expect(n.x + n.width).toBeLessThanOrEqual(p.width)
      expect(n.y + n.height).toBeLessThanOrEqual(p.height)
    }
    for (const q of flattenGroups(p.groups)) {
      expect(q.x).toBeGreaterThanOrEqual(0)
      expect(q.y).toBeGreaterThanOrEqual(0)
      expect(q.x + q.width).toBeLessThanOrEqual(p.width)
      expect(q.y + q.height).toBeLessThanOrEqual(p.height)
    }
  })
})

describe('layoutFlowchartSync: other shapes of subgraph diagram', () => {
  const cases: Array<[string, string]> = [
    [
      'cluster in the middle',
      'graph TD\n  S --> A\n  subgraph mid [Middle]\n    A --> B\n    B --> C\n  end\n  C --> E',
    ],
    [
      'two clusters, cross edges',
      'graph TD\n  subgraph l [Left]\n    L1 --> L2\n    L2 --> L3\n  end\n  subgraph r [Right]\n    R1 --> R2\n  end\n  L1 --> R1\n  R2 --> L3',
    ],
    [
      'outsiders on both sides',
      'graph TD\n  X --> A1\n  subgraph box [Box]\n    A1 --> A2\n    A2 --> A3\n  end\n  A3 --> Y\n  X --> Z\n  Z --> Y',
    ],
    [
      'nested, with an outside edge',
      'graph TD\n  subgraph outer [Outer]\n    subgraph inner [Inner]\n      I1 --> I2\n    end\n    O1 --> I1\n  end\n  Start --> O1\n  I2 --> Done',
    ],
    [
      'left to right',
      'graph LR\n  In --> P1\n  subgraph pipe [Pipeline]\n    P1 --> P2\n    P2 --> P3\n  end\n  P3 --> Out\n  In --> Side\n  Side --> Out',
    ],
    [
      'bottom to top',
      'graph BT\n  subgraph s [S]\n    A --> B\n    B --> C\n  end\n  C --> D\n  X --> A',
    ],
    [
      'three clusters side by side',
      'flowchart TB\n  c1 --> a2\n  subgraph one\n    a1 --> a2\n  end\n  subgraph two\n    b1 --> b2\n  end\n  subgraph three\n    c1 --> c2\n  end',
    ],
    [
      'a loop through a cluster',
      'graph TD\n  Start --> A\n  subgraph loop [Retry loop]\n    A --> B{OK?}\n    B -->|No| A\n  end\n  B -->|Yes| Done',
    ],
  ]

  it.each(cases)('keeps every box clear: %s', (_name, source) => {
    expectBoxesClear(source, layoutFlowchartSync(graphOf(source)))
  })

  it.each(cases)(
    'leaves a visible gap around every box: %s',
    (_name, source) => {
      const g = graphOf(source)
      const p = layoutFlowchartSync(g)
      const gap = (
        a: { x: number; y: number; width: number; height: number },
        b: { x: number; y: number; width: number; height: number },
      ): number =>
        Math.max(
          a.x - (b.x + b.width),
          b.x - (a.x + a.width),
          a.y - (b.y + b.height),
          b.y - (a.y + a.height),
        )
      const all = (list: MermaidSubgraph[]): MermaidSubgraph[] =>
        list.flatMap((s) => [s, ...all(s.children)])
      const groups = new Map(flattenGroups(p.groups).map((q) => [q.id, q]))
      for (const s of all(g.subgraphs)) {
        const inside = membersOf(s)
        for (const n of p.nodes) {
          if (inside.has(n.id)) continue
          expect(
            gap(n, groups.get(s.id)!),
            `${n.id} beside ${s.id}`,
          ).toBeGreaterThanOrEqual(8)
        }
      }
    },
  )

  it('makes a box at least as wide as its title', () => {
    const source =
      'graph TD\n  X --> A\n  subgraph s [A long subgraph title that is wider than its only node]\n    A\n  end'
    const group = layoutFlowchartSync(graphOf(source)).groups[0]!
    const title = measureMultilineText(
      group.label,
      FONT_SIZES.groupHeader,
      FONT_WEIGHTS.groupHeader,
    ).width
    expect(group.width).toBeGreaterThanOrEqual(title + 24)
  })

  it('puts the cluster whose edge closes the cycle on the left, as mermaid 12 does', () => {
    const [, source] = cases[1]!
    const p = layoutFlowchartSync(graphOf(source))
    const left = p.groups.find((q) => q.id === 'l')!
    const right = p.groups.find((q) => q.id === 'r')!
    // `R2 --> L3` is the feedback edge (#1993), so mermaid 12.1.0 draws `r`
    // on the left even though `l` is declared first.
    expect(right.x).toBeLessThan(left.x)
  })

  it('arranges "outsiders on both sides" with the side node beside the box', () => {
    const [, source] = cases[2]!
    const p = layoutFlowchartSync(graphOf(source))
    const box = p.groups[0]!
    const z = p.nodes.find((n) => n.id === 'Z')!
    // Z is beside the box, not above or below it.
    expect(z.x + z.width <= box.x || z.x >= box.x + box.width).toBe(true)
  })

  it('draws siblings tied by a shared outside node in declaration order (mermaid 12 ELK)', () => {
    // Checked against mermaid@12.2.0 in Chrome: east at x=112, west at x=352.
    const source =
      'graph TD\n  subgraph east [East]\n    A --> B\n  end\n  subgraph west [West]\n    C --> D\n  end\n  E --> A\n  E --> C'
    const p = layoutFlowchartSync(graphOf(source))
    const east = p.groups.find((q) => q.id === 'east')!
    const west = p.groups.find((q) => q.id === 'west')!
    expect(east.x).toBeLessThan(west.x)
  })

  it('draws unconnected sibling subgraphs in reverse declaration order (mermaid 12 ELK)', () => {
    // mermaid@12.2.0: east at x=352, west at x=112.
    const source =
      'graph TD\n  subgraph east [East]\n    A --> B\n  end\n  subgraph west [West]\n    C --> D\n  end'
    const p = layoutFlowchartSync(graphOf(source))
    const east = p.groups.find((q) => q.id === 'east')!
    const west = p.groups.find((q) => q.id === 'west')!
    expect(west.x).toBeLessThan(east.x)
  })

  it('draws a nested subgraph inside its parent', () => {
    const [, source] = cases[3]!
    const outer = layoutFlowchartSync(graphOf(source)).groups[0]!
    const inner = outer.children[0]!
    expect(inner.id).toBe('inner')
    expect(inner.x).toBeGreaterThanOrEqual(outer.x)
    expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width)
    expect(inner.y).toBeGreaterThanOrEqual(outer.y)
    expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height)
  })
})

/** `layoutFlowchartSync` also marks flowchart groups `bandless` (#2636). */
const unmarked = (p: unknown): unknown =>
  JSON.parse(JSON.stringify(p, (k, v) => (k === 'bandless' ? undefined : v)))

describe('layoutFlowchartSync: a graph with no subgraph', () => {
  it('is laid out by layoutGraphSync', () => {
    const g = graphOf('graph TD\n  A --> B\n  B --> C')
    expect(unmarked(layoutFlowchartSync(g))).toEqual(
      unmarked(layoutGraphSync(g)),
    )
  })
})

describe('layoutGraphSync', () => {
  it('still lays a subgraph out as a block, for the diagram types that share the engine', () => {
    const g = graphOf(CI_CD)
    const p = layoutGraphSync(g)
    // Nested layout: the box surrounds everything laid out after it in the
    // same column, so Deploy Staging sits above the box, not beside it.
    const e = p.nodes.find((n) => n.id === 'E')!
    const ci = p.groups[0]!
    expect(e.x + e.width > ci.x && e.x < ci.x + ci.width).toBe(true)
  })
})

describe('edge trunks beside a box side (#1749)', () => {
  it('keeps the fan-out trunk at least 8px from the source box', () => {
    const p = layoutFlowchartSync(
      graphOf(`graph LR
  subgraph clients [Client Layer]
    A([Web App]) --> B[API Gateway]
  end
  subgraph services [Service Layer]
    B --> D[Auth Service]
    B --> E[User Service]
    B --> F[Order Service]
  end`),
    )
    const clients = p.groups.find((g) => g.id === 'clients')!
    const side = clients.x + clients.width
    const trunks = p.edges
      .filter((e) => e.source === 'B')
      .flatMap((e) => e.points.slice(1, -1).map((pt) => pt.x))
    expect(trunks.length).toBeGreaterThan(0)
    for (const x of trunks) expect(Math.abs(x - side)).toBeGreaterThanOrEqual(8)
  })
})

describe('clearBorders (#1749)', () => {
  // Scenes are written for a left-to-right flow (the cross-flow run is a
  // vertical line at some x) and transposed for a top-down one.
  const flip = (dir: Direction, x: number, y: number) =>
    dir === 'TD' ? { x: y, y: x } : { x, y }
  const box = (dir: Direction, x: number, y: number, w: number, h: number) => {
    const a = flip(dir, x, y)
    const b = flip(dir, w, h)
    return { x: a.x, y: a.y, width: b.x, height: b.y }
  }
  const group = (dir: Direction, x: number, y: number, w: number, h: number) =>
    ({
      id: 'g',
      label: 'g',
      children: [],
      ...box(dir, x, y, w, h),
    }) as PositionedGroup
  const node = (dir: Direction, x: number, y: number, w: number, h: number) =>
    ({
      id: 'n',
      label: 'n',
      shape: 'rectangle',
      ...box(dir, x, y, w, h),
    }) as PositionedNode
  const edge = (dir: Direction, pts: [number, number][]) =>
    ({
      source: 'a',
      target: 'b',
      points: pts.map(([x, y]) => flip(dir, x, y)),
    }) as PositionedEdge
  /** The run coordinate (along the flow) of every interior point. */
  const flow = (dir: Direction, e: PositionedEdge) =>
    e.points.slice(1, -1).map((p) => (dir === 'TD' ? p.y : p.x))

  describe.each(['LR', 'TD'] as const)('%s', (dir) => {
    // The group spans x 0..100, y 0..100; its right side is at 100.
    const g = () => group(dir, 0, 0, 100, 100)
    const run = (at: number, before = 50, after = 150) =>
      edge(dir, [
        [before, 50],
        [at, 50],
        [at, 80],
        [after, 80],
      ])
    const apply = (e: PositionedEdge[], nodes: PositionedNode[] = []) =>
      clearBorders(e, nodes, [g()], dir)

    it('moves a run hugging the far side out to 8px', () => {
      const e = run(102)
      apply([e])
      expect(flow(dir, e)).toEqual([108, 108])
    })

    it('moves a run hugging the near side out to 8px, away from the box', () => {
      const e = edge(dir, [
        [-50, 50],
        [98, 50],
        [98, 80],
        [150, 80],
      ])
      clearBorders([e], [], [group(dir, 100, 0, 100, 100)], dir)
      expect(flow(dir, e)).toEqual([92, 92])
    })

    it('leaves a run already 8px or more from the side', () => {
      const e = run(110)
      apply([e])
      expect(flow(dir, e)).toEqual([110, 110])
    })

    it('leaves a run beside a side it does not overlap', () => {
      for (const [y1, y2] of [
        [150, 180], // Past the box
        [-80, -50], // Before the box
      ] as const) {
        const e = edge(dir, [
          [50, y1],
          [102, y1],
          [102, y2],
          [150, y2],
        ])
        apply([e])
        expect(flow(dir, e)).toEqual([102, 102])
      }
    })

    it('keeps the run between its neighbouring points', () => {
      const e = run(102, 50, 105)
      apply([e])
      expect(flow(dir, e)).toEqual([102, 102])
    })

    it('leaves a run whose neighbours sit at the same coordinate', () => {
      const e = run(102, 150, 150)
      apply([e])
      expect(flow(dir, e)).toEqual([102, 102])
    })

    it('does not move a run into a node', () => {
      const e = run(102)
      apply([e], [node(dir, 104, 60, 20, 40)])
      expect(flow(dir, e)).toEqual([102, 102])
    })

    it('moves a run past a node that is clear of its span', () => {
      for (const n of [
        node(dir, 100, 200, 40, 20), // Straddles the target, beyond the run
        node(dir, 100, -60, 40, 20), // Straddles the target, before the run
        node(dir, 0, 40, 100, 40), // Ends before the target
        node(dir, 108, 40, 40, 40), // Starts at the target
      ]) {
        const e = run(102)
        apply([e], [n])
        expect(flow(dir, e)).toEqual([108, 108])
      }
    })

    it('moves every edge of a shared trunk together', () => {
      const a = run(102)
      const b = edge(dir, [
        [50, 50],
        [102, 50],
        [102, 30],
        [150, 30],
      ])
      apply([a, b])
      expect(flow(dir, a)).toEqual([108, 108])
      expect(flow(dir, b)).toEqual([108, 108])
    })

    it('never moves an edge endpoint', () => {
      const e = edge(dir, [
        [102, 50],
        [102, 80],
        [150, 80],
      ])
      apply([e])
      expect(e.points[0]).toEqual(flip(dir, 102, 50))
    })

    it('clears the side of the nested box it is beside', () => {
      const e = run(102)
      clearBorders(
        [e],
        [],
        [group(dir, 0, 0, 300, 100), group(dir, 20, 20, 82, 60)], // Inner right side at 102
        dir,
      )
      expect(flow(dir, e)).toEqual([110, 110])
    })
  })
})
