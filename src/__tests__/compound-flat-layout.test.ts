/**
 * #1239: ELK lays a subgraph out as a block before the nodes around it, so a
 * flowchart with subgraphs could not be arranged the way mermaid.js arranges
 * it. `layoutFlowchartSync` lays the whole graph out flat and draws each
 * subgraph's box around its members, keeping the other nodes clear of the box
 * (see packages/svg-renderer/src/layout-engine/compound-flat.ts).
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid, renderMermaidSVG } from '../index.ts'
import {
  layoutFlowchartSync,
  layoutGraphSync,
} from '@zombie-mermaid/svg-renderer'
import {
  canLayOutFlat,
  layerIndexes,
  orderNodes,
  orderSiblings,
  planSpines,
} from '../../packages/svg-renderer/src/layout-engine/compound-flat.ts'
import { measureMultilineText } from '@zombie-mermaid/core'
import {
  FONT_SIZES,
  FONT_WEIGHTS,
} from '../../packages/svg-renderer/src/styles.ts'
import type {
  MermaidGraph,
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

const sg = (
  id: string,
  nodeIds: string[],
  children: MermaidSubgraph[] = [],
): MermaidSubgraph => ({ id, label: id, nodeIds, children })

const box = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
) => ({
  id,
  x,
  y,
  width,
  height,
})

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

describe('layerIndexes', () => {
  it('puts nodes whose centres line up in one layer (TD)', () => {
    // A box and a taller diamond, centred on the same row, then a row below.
    const layers = layerIndexes(
      [
        box('A', 0, 10, 100, 40),
        box('B', 150, -10, 100, 80),
        box('C', 0, 120, 100, 40),
      ],
      'TD',
    )
    expect(layers.get('A')).toBe(0)
    expect(layers.get('B')).toBe(0)
    expect(layers.get('C')).toBe(1)
  })

  it('puts nodes whose start edges line up in one layer, whatever their widths (LR)', () => {
    // ELK left-aligns the nodes of an LR layer, so their centres differ.
    const layers = layerIndexes(
      [
        box('A', 47, 0, 102, 40),
        box('C', 47, 80, 116, 40),
        box('B', 204, 40, 125, 40),
      ],
      'LR',
    )
    expect(layers.get('A')).toBe(0)
    expect(layers.get('C')).toBe(0)
    expect(layers.get('B')).toBe(1)
  })

  it('counts from the other end for BT and RL', () => {
    const nodes = [box('top', 0, 0, 100, 40), box('bottom', 0, 200, 100, 40)]
    expect(layerIndexes(nodes, 'TD').get('top')).toBe(0)
    expect(layerIndexes(nodes, 'BT').get('top')).toBe(1)
    expect(layerIndexes(nodes, 'BT').get('bottom')).toBe(0)
    const row = [box('left', 0, 0, 100, 40), box('right', 300, 0, 100, 40)]
    expect(layerIndexes(row, 'LR').get('left')).toBe(0)
    expect(layerIndexes(row, 'RL').get('left')).toBe(1)
  })

  it('handles no nodes', () => {
    expect(layerIndexes([], 'TD').size).toBe(0)
  })
})

describe('planSpines', () => {
  const layer = new Map([
    ['M1', 0],
    ['M2', 2],
    ['M3', 3],
    ['Q', 1],
  ])
  const cross = (id: string): number =>
    ({ M1: 10, M2: 10, M3: 10, Q: 200 })[id] ?? 0

  it('adds a spine node in each layer the subgraph skips, chained to its members', () => {
    const plan = planSpines([sg('c', ['M1', 'M2', 'M3'])], layer, cross)
    expect(plan.ghosts).toEqual([{ id: '__zm_spine__c__1', subgraph: 'c' }])
    expect(plan.edges.map((e) => `${e.source}->${e.target}`)).toEqual([
      'M1->__zm_spine__c__1',
      '__zm_spine__c__1->M2',
    ])
    expect(plan.edges.every((e) => e.style === 'invisible')).toBe(true)
  })

  it('adds nothing for members in neighbouring layers', () => {
    const plan = planSpines([sg('c', ['M2', 'M3'])], layer, cross)
    expect(plan.ghosts).toEqual([])
    expect(plan.edges).toEqual([])
  })

  it('adds nothing for a subgraph in a single layer', () => {
    expect(planSpines([sg('c', ['M1'])], layer, cross).ghosts).toEqual([])
  })

  it('chains from the leftmost member of a layer', () => {
    const wide = new Map([
      ['L', 0],
      ['R', 0],
      ['M', 2],
    ])
    const at = (id: string): number => ({ L: 5, R: 90, M: 0 })[id] ?? 0
    const plan = planSpines([sg('c', ['R', 'L', 'M'])], wide, at)
    expect(plan.edges[0]!.source).toBe('L')
  })

  it('plans each subgraph, nested ones included, on its own', () => {
    const inner = sg('inner', ['M1', 'M2'])
    const plan = planSpines([sg('outer', ['M3'], [inner]), inner], layer, cross)
    expect(plan.ghosts.map((g) => g.subgraph)).toEqual(['outer', 'inner'])
  })

  it('skips a subgraph with no laid-out member', () => {
    expect(planSpines([sg('c', ['nobody'])], layer, cross).ghosts).toEqual([])
  })
})

describe('orderNodes', () => {
  const layer = new Map([
    ['M1', 0],
    ['M2', 2],
    ['X', 1],
    ['Y', 1],
    ['Z', 5],
  ])
  const ghost = '__zm_spine__c__1'
  // The members are spread out and X and Y fall between them, so only the
  // adjustment (not the plain left-to-right order) keeps the members together.
  const keys = new Map([
    ['M1', 40],
    ['M2', 160],
    ['X', 90],
    ['Y', 120],
    ['Z', 100],
    [ghost, 100],
  ])
  const original = ['M1', 'M2', 'X', 'Y', 'Z', ghost]
  const order = orderNodes(
    original,
    keys,
    layer,
    [sg('c', ['M1', 'M2'])],
    new Map([['c', [ghost]]]),
  )

  it("puts an outsider within the subgraph's layers on the side it was nearer", () => {
    expect(order.indexOf('X')).toBeLessThan(order.indexOf('M1'))
    expect(order.indexOf('Y')).toBeGreaterThan(order.indexOf('M2'))
    expect(order.indexOf('Y')).toBeGreaterThan(order.indexOf(ghost))
  })

  it("leaves an outsider beyond the subgraph's layers where it was", () => {
    // Z shares nothing with the subgraph's layers; it keeps its own position.
    expect(order.indexOf('Z')).toBeGreaterThan(order.indexOf('X'))
    expect(order.indexOf('Z')).toBeLessThan(order.indexOf('Y'))
  })

  it('returns every node once', () => {
    expect([...order].sort()).toEqual([...original].sort())
  })

  it('keeps ties in the original order', () => {
    const tie = orderNodes(
      ['A', 'B', 'C'],
      new Map([
        ['A', 5],
        ['B', 5],
        ['C', 5],
      ]),
      new Map(),
      [],
      new Map(),
    )
    expect(tie).toEqual(['A', 'B', 'C'])
  })
})

describe('orderSiblings', () => {
  // Two sibling subgraphs side by side in the same layers: a on the left, b on the right.
  const a = sg('a', ['a1', 'a2'])
  const b = sg('b', ['b1', 'b2'])
  const layer = new Map([
    ['a1', 0],
    ['a2', 1],
    ['b1', 0],
    ['b2', 1],
  ])
  const sideBySide = (): Map<string, number> =>
    new Map([
      ['a1', 10],
      ['a2', 20],
      ['b1', 110],
      ['b2', 120],
    ])

  it('swaps siblings that sit side by side into reverse declaration order', () => {
    // mermaid.js draws `subgraph a` then `subgraph b` with b on the left.
    const keys = sideBySide()
    orderSiblings([a, b], layer, keys)
    expect(keys.get('b1')!).toBeLessThan(keys.get('a1')!)
    expect(keys.get('b2')!).toBeLessThan(keys.get('a2')!)
  })

  it('moves each subgraph as a whole, keeping its own nodes in their order', () => {
    const keys = sideBySide()
    orderSiblings([a, b], layer, keys)
    expect(keys.get('a2')! - keys.get('a1')!).toBe(10)
    expect(keys.get('b2')! - keys.get('b1')!).toBe(10)
  })

  it('puts them in the slots the pair already occupied', () => {
    const keys = sideBySide()
    orderSiblings([a, b], layer, keys)
    const means = [
      (keys.get('a1')! + keys.get('a2')!) / 2,
      (keys.get('b1')! + keys.get('b2')!) / 2,
    ].sort((x, y) => x - y)
    expect(means).toEqual([15, 115])
  })

  it('leaves them alone when they are already in that order', () => {
    const keys = new Map([
      ['a1', 110],
      ['a2', 120],
      ['b1', 10],
      ['b2', 20],
    ])
    const before = new Map(keys)
    orderSiblings([a, b], layer, keys)
    expect(keys).toEqual(before)
  })

  it('leaves subgraphs in different layers alone', () => {
    const stacked = new Map([
      ['a1', 0],
      ['a2', 1],
      ['b1', 2],
      ['b2', 3],
    ])
    const keys = sideBySide()
    const before = new Map(keys)
    orderSiblings([a, b], stacked, keys)
    expect(keys).toEqual(before)
  })

  it('orders the children of each subgraph too', () => {
    const outer = sg('outer', [], [a, b])
    const keys = sideBySide()
    orderSiblings([outer], layer, keys)
    expect(keys.get('b1')!).toBeLessThan(keys.get('a1')!)
  })

  it('does nothing for a lone subgraph', () => {
    const keys = sideBySide()
    const before = new Map(keys)
    orderSiblings([a], layer, keys)
    expect(keys).toEqual(before)
  })
})

describe('canLayOutFlat', () => {
  it('accepts an ordinary flowchart with subgraphs', () => {
    expect(canLayOutFlat(graphOf(CI_CD))).toBe(true)
  })

  it('rejects a graph with no subgraph', () => {
    expect(canLayOutFlat(graphOf('graph TD\n  A --> B'))).toBe(false)
  })

  it('rejects a subgraph with its own direction', () => {
    expect(
      canLayOutFlat(
        graphOf('graph TD\n  subgraph s\n    direction LR\n    A --> B\n  end'),
      ),
    ).toBe(false)
  })

  it('rejects a state diagram', () => {
    expect(
      canLayOutFlat(
        graphOf(
          'stateDiagram-v2\n  [*] --> A\n  state A {\n    [*] --> B\n  }',
        ),
      ),
    ).toBe(false)
  })

  it('rejects a graph with state markers, whatever else is true of it', () => {
    // An ordinary subgraph graph plus a start marker, so nothing but the state
    // check can be what turns it away.
    const g = graphOf('graph TD\n  subgraph s\n    A --> B\n  end\n  X --> A')
    expect(canLayOutFlat(g)).toBe(true)
    g.nodes.set('start', { id: 'start', label: '', shape: 'state-start' })
    expect(canLayOutFlat(g)).toBe(false)
  })

  it('rejects an edge to a subgraph, which has no node to attach to', () => {
    expect(
      canLayOutFlat(
        graphOf('graph TD\n  A --> s\n  subgraph s\n    B --> C\n  end'),
      ),
    ).toBe(false)
  })

  it('rejects a subgraph with no node in it', () => {
    const g = graphOf('graph TD\n  subgraph s\n    A\n  end\n  B --> C')
    g.subgraphs.push(sg('empty', []))
    expect(canLayOutFlat(g)).toBe(false)
  })

  it('rejects a node whose id collides with a spine node', () => {
    const g = graphOf('graph TD\n  subgraph s\n    A --> B\n  end')
    g.nodes.set('__zm_spine__x', {
      id: '__zm_spine__x',
      label: 'x',
      shape: 'rectangle',
    })
    expect(canLayOutFlat(g)).toBe(false)
  })
})

describe('layoutFlowchartSync: the CI/CD sample', () => {
  const p = layoutFlowchartSync(graphOf(CI_CD))
  const ci = p.groups[0]!
  const node = (id: string) => p.nodes.find((n) => n.id === id)!

  it('keeps every node that is not in the pipeline clear of its box', () => {
    expectBoxesClear(CI_CD, p)
  })

  it('puts Deploy Staging, QA Approved? and Production in a column beside the box', () => {
    for (const id of ['E', 'F', 'G']) {
      expect(node(id).x + node(id).width, id).toBeLessThanOrEqual(ci.x)
    }
  })

  it('ranks Fix & Retry after QA Approved?, as mermaid.js does', () => {
    expect(node('D').y).toBeGreaterThan(node('F').y)
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

  it('arranges "outsiders on both sides" with the side node beside the box', () => {
    const [, source] = cases[2]!
    const p = layoutFlowchartSync(graphOf(source))
    const box = p.groups[0]!
    const z = p.nodes.find((n) => n.id === 'Z')!
    // Z is beside the box, not above or below it.
    expect(z.x + z.width <= box.x || z.x >= box.x + box.width).toBe(true)
  })

  it('draws sibling subgraphs in reverse declaration order, as mermaid.js does', () => {
    const source =
      'graph TD\n  subgraph east [East]\n    A --> B\n  end\n  subgraph west [West]\n    C --> D\n  end\n  E --> A\n  E --> C'
    const p = layoutFlowchartSync(graphOf(source))
    const east = p.groups.find((q) => q.id === 'east')!
    const west = p.groups.find((q) => q.id === 'west')!
    // `west` is declared second, so it is drawn on the left.
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

describe('layoutFlowchartSync: falls back to the nested layout', () => {
  it('for a subgraph with its own direction', () => {
    const g = graphOf(
      'graph TD\n  subgraph s\n    direction LR\n    A --> B\n  end\n  X --> A',
    )
    expect(layoutFlowchartSync(g)).toEqual(layoutGraphSync(g))
  })

  it('for an edge to a subgraph', () => {
    const g = graphOf('graph TD\n  A --> s\n  subgraph s\n    B --> C\n  end')
    expect(layoutFlowchartSync(g)).toEqual(layoutGraphSync(g))
  })

  it('for a graph with no subgraph', () => {
    const g = graphOf('graph TD\n  A --> B\n  B --> C')
    expect(layoutFlowchartSync(g)).toEqual(layoutGraphSync(g))
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
