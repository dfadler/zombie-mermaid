import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import {
  describeSample,
  addCounts,
  compareFaces,
  compareEnds,
  compareLoops,
  compareSpots,
  emptyCounts,
  inScope,
  isExact,
  scoreSubgraphLoops,
  subgraphLoopCases,
  isGraph,
  measureEr,
  measureSample,
  readErText,
  readGrid,
} from '../scripts/lib/ascii-topology.ts'
import type { AsciiLayoutHints } from '@zombie-mermaid/ascii-renderer'
import type { Spot } from '../scripts/lib/ascii-topology.ts'

const spot = (main: number, cross: number, size = 10): Spot => ({
  main,
  cross,
  size,
})

describe('compareSpots', () => {
  it('counts layer relation, in-layer order and alignment per pair', () => {
    // ELK px: A and B share a layer (within 20 px), C is below.
    const elk = {
      A: spot(0, 0, 100),
      B: spot(10, 200, 100),
      C: spot(300, 100, 100),
    }
    // Grid cells: same shape.
    const same = { A: spot(0, 0, 10), B: spot(1, 20, 10), C: spot(30, 10, 10) }
    const c = compareSpots(elk, same)
    expect(c).toMatchObject({
      layerPairs: 3,
      layerOk: 3,
      orderPairs: 1,
      orderOk: 1,
      alignOk: 3,
    })
    expect(c.alignDev).toBeCloseTo(0)
  })

  it('flags a swapped order, a collapsed layer and a drifted alignment', () => {
    const elk = {
      A: spot(0, 0, 100),
      B: spot(0, 200, 100),
      C: spot(300, 0, 100),
    }
    const grid = { A: spot(0, 20, 10), B: spot(0, 0, 10), C: spot(0, 0, 10) }
    const c = compareSpots(elk, grid)
    expect(c.orderOk).toBe(0) // B is right of A in ELK, left on the grid
    expect(c.layerOk).toBe(1) // A/B agree; C is a layer later in ELK only
    expect(c.alignOk).toBeLessThan(c.layerPairs)
    expect(isExact(c)).toBe(false)
  })

  it('ignores nodes the grid does not have', () => {
    expect(
      compareSpots({ A: spot(0, 0), Z: spot(9, 9) }, { A: spot(0, 0) })
        .layerPairs,
    ).toBe(0)
  })
})

describe('compareFaces', () => {
  it('matches edges by endpoints, treats a slant as either neighbour, skips unknown edges', () => {
    const grid = [
      { from: 'A', to: 'B', start: ['B' as const], end: ['T' as const] },
      {
        from: 'A',
        to: 'B',
        start: ['R' as const, 'B' as const],
        end: ['L' as const],
      },
    ]
    const end = (face: 'T' | 'B' | 'L' | 'R') => ({ face, order: 0 })
    const hints = {
      nodes: new Map(),
      edges: [
        { index: 0, from: 'A', to: 'B', start: end('B'), end: end('T') },
        { index: 1, from: 'A', to: 'B', start: end('B'), end: end('T') },
        { index: 2, from: 'X', to: 'Y', start: end('B'), end: end('T') },
      ],
    }
    expect(compareFaces(grid, hints)).toMatchObject({ faceEnds: 4, faceOk: 3 })
  })
})

describe('self-loop hooks (#2913)', () => {
  it('counts distinct drawn paths per node against the loop edges', () => {
    const e = (from: string, to: string, path?: string) => ({
      from,
      to,
      start: [],
      end: [],
      path,
    })
    expect(
      compareLoops([
        e('A', 'A', '0,0'),
        e('A', 'A', '0,0'),
        e('A', 'B', '1,1'),
      ]),
    ).toMatchObject({ loops: 2, loopHooks: 1 })
    expect(
      compareLoops([e('A', 'A', '0,0'), e('A', 'A', '1,1'), e('B', 'B')]),
    ).toMatchObject({ loops: 3, loopHooks: 3 })
  })

  it('measures one hook per loop, for one loop and for duplicates, in every direction', () => {
    for (const dir of ['TD', 'LR', 'RL', 'BT']) {
      const one = measureSample(`flowchart ${dir}\n  A --> A`)
      expect(one).toMatchObject({ loops: 1, loopHooks: 1 })
      const two = measureSample(`flowchart ${dir}\n  A --> A\n  A --> A`)
      expect(two.loops, dir).toBe(2)
      // mermaid@12.3.0 nests two hooks; the grid draws two.
      expect(two.loopHooks, dir).toBe(2)
      expect(isExact(two), dir).toBe(true)
    }
  })

  it('fails the sample and names the miss when hooks fall short', () => {
    const c = { ...emptyCounts(), loops: 2, loopHooks: 1 }
    expect(isExact(c)).toBe(false)
    expect(describeSample('T', c, false)).toBe(
      'layer 0/0 order 0/0 self-loop hooks 1/2  T',
    )
  })
})

describe('subgraph self-loop cases (#2913)', () => {
  it('gives six shapes per direction, and one direction when asked', () => {
    expect(subgraphLoopCases()).toHaveLength(24)
    const td = subgraphLoopCases(['TD'])
    expect(td).toHaveLength(6)
    expect(td.every((c) => c.source.startsWith('flowchart TD\n'))).toBe(true)
  })

  it('scores a duplicate loop in a frame exact in every direction', () => {
    for (const c of subgraphLoopCases()) {
      const m = measureSample(c.source)
      expect(m.loopHooks, c.title).toBe(m.loops)
      expect(m.faceOk, c.title).toBe(m.faceEnds)
    }
  })
})

describe('scoreSubgraphLoops (#2913)', () => {
  it('scores every case exact and lists only misses, or every case when asked', () => {
    const quiet = scoreSubgraphLoops()
    expect(quiet).toMatchObject({ cases: 24, exact: 24, lines: [] })
    expect(quiet.counts.loopHooks).toBe(quiet.counts.loops)
    const all = scoreSubgraphLoops(true)
    expect(all.lines).toHaveLength(24)
    expect(all.lines[0]).toMatch(/^subgraph loops: layer .* TD 2 loops/)
  })

  it('narrows to the direction after --dir', () => {
    const argv = process.argv
    process.argv = [...argv, '--dir', 'LR']
    try {
      expect(scoreSubgraphLoops()).toMatchObject({ cases: 6, exact: 6 })
    } finally {
      process.argv = argv
    }
  })
})

describe('compareEnds', () => {
  const hint = (from: string, to: string, order: number) => ({
    index: 0,
    from,
    to,
    start: { face: 'B' as const, order: 0 },
    end: { face: 'T' as const, order },
  })
  const hints = (...e: ReturnType<typeof hint>[]): AsciiLayoutHints => ({
    nodes: new Map(),
    edges: e,
  })
  const g = (from: string, to: string, endCell?: string, arrows = 1) => ({
    from,
    to,
    start: [],
    end: [],
    endCell,
    arrows,
  })

  it('counts a shared end cell once where the hints give two positions', () => {
    const h = hints(hint('A', 'C', 0), hint('B', 'C', 1))
    expect(
      compareEnds([g('A', 'C', '1,1'), g('B', 'C', '1,1')], h, 1),
    ).toMatchObject({ endCellsWant: 2, endCells: 1, arrowsWant: 2, arrows: 1 })
    expect(
      compareEnds([g('A', 'C', '1,1'), g('B', 'C', '5,1')], h, 2),
    ).toMatchObject({ endCellsWant: 2, endCells: 2, arrowsWant: 2, arrows: 2 })
  })

  it('wants one cell for ends the hints put at one position, and skips loops and unread ends', () => {
    const h = hints(hint('A', 'C', 0), hint('B', 'C', 0), hint('C', 'C', 1))
    expect(
      compareEnds(
        [g('A', 'C', '1,1'), g('B', 'C', '1,1'), g('C', 'C', '2,2')],
        h,
        3,
      ),
    ).toMatchObject({ endCellsWant: 1, endCells: 1 })
    expect(compareEnds([g('A', 'C'), g('B', 'C')], h, 0)).toMatchObject({
      endCellsWant: 0,
      endCells: 0,
    })
  })

  it('skips a hint with no drawn edge', () => {
    expect(
      compareEnds([g('A', 'C', '1,1')], hints(hint('X', 'Y', 0)), 0),
    ).toMatchObject({ endCellsWant: 0, endCells: 0 })
  })

  it('reads a fan-in bundle as one cell and one arrowhead', () => {
    // Three strokes into a 3-cell-wide target cannot land one by one (#2678).
    const c = measureSample('flowchart TD\n  A & B & C --> D')
    expect(c).toMatchObject({
      endCellsWant: 3,
      endCells: 1,
      arrowsWant: 3,
      arrows: 1,
    })
    expect(describeSample('T', c, false)).toContain(
      'end cells 1/3 arrowheads 1/3',
    )
  })

  it('is exact for separate landings', () => {
    const c = measureSample('flowchart TD\n  A --> B')
    expect(c).toMatchObject({
      endCellsWant: 1,
      endCells: 1,
      arrowsWant: 1,
      arrows: 1,
    })
    expect(describeSample('T', c, false)).not.toContain('end cells')
  })
})

describe('cluster-edge ends (#2913)', () => {
  const SRC =
    'flowchart TD\n  subgraph S\n    a --> b\n  end\n  S --> x\n  b --> y'

  it('reads an edge addressed from a subgraph id under the id, as the hints carry it', () => {
    const { edges } = readGrid(SRC)
    expect(edges.map((e) => `${e.from}>${e.to}`)).toContain('S>x')
  })

  it('scores the cluster edge’s ends: 2 more ends than the member edges alone', () => {
    // Three edges (a>b, S>x, b>y), six ends
    expect(measureSample(SRC).faceEnds).toBe(6)
  })
})

describe('readGrid and measureSample', () => {
  it('reads spots and un-mirrored faces for every direction', () => {
    for (const dir of ['TD', 'BT', 'LR', 'RL']) {
      const g = readGrid(`graph ${dir}\n  A --> B\n  A --> C`)
      expect(Object.keys(g.spots).sort()).toEqual(['A', 'B', 'C'])
      expect(g.edges).toHaveLength(2)
      expect(g.direction).toBe(dir)
      // The first edge leaves A on the flow-forward face.
      const forward = { TD: 'B', BT: 'T', LR: 'R', RL: 'L' }[dir]
      expect(g.edges[0]!.start).toContain(forward)
    }
  })

  it('scores a plain chain as exact in all four directions', () => {
    for (const dir of ['TD', 'BT', 'LR', 'RL']) {
      const c = measureSample(`graph ${dir}\n  A --> B --> C`)
      expect(isExact(c)).toBe(true)
      expect(c.layerPairs).toBe(3)
      expect(c.faceEnds).toBe(4)
      expect(c.faceOk).toBe(4)
    }
  })

  it('aligns layers on the flow-leading edge, so unequal widths stay one layer', () => {
    // ELK centres of User Service and Cache differ by >20 px; their leading edges match.
    for (const dir of ['LR', 'RL', 'TD', 'BT']) {
      const c = measureSample(
        `graph ${dir}\n  C(Mobile App) --> B(API Gateway)\n  B --> E(User Service)\n  B -.-> F(Cache)\n  B ==> G(Queue)`,
      )
      expect(c.layerOk).toBe(c.layerPairs)
    }
  })

  it('keeps a diamond and shorter boxes in one layer in every direction', () => {
    for (const dir of ['LR', 'RL', 'TD', 'BT']) {
      const c = measureSample(
        // #2780: isolated nodes sit beside a taller decision.
        `flowchart ${dir}\n  n0(["n54J9wn"])\n  n1(["m"])\n  n2{"1z"}\n  n3(["5Ux716"])\n  n4("E8Hl7O")\n  n2 --> n0\n  n2 --> n0\n  n2 --> n3\n`,
      )
      expect(c.layerOk, dir).toBe(c.layerPairs)
    }
  })

  it('sums counts', () => {
    const a = measureSample('graph TD\n  A --> B')
    expect(addCounts(a, emptyCounts())).toEqual(a)
    expect(parseMermaid('graph TD\n  A --> B').nodes.size).toBe(2)
  })
})

describe('describeSample', () => {
  it('prints layers and order, and alignment and faces when asked', () => {
    const c = {
      ...emptyCounts(),
      layerPairs: 3,
      layerOk: 3,
      alignOk: 2,
      faceEnds: 4,
      faceOk: 1,
    }
    expect(describeSample('T', c, false)).toBe('layer 3/3 order 0/0  T')
    expect(describeSample('T', c, true)).toBe(
      'layer 3/3 order 0/0 align 2/3 faces 1/4  T',
    )
  })
})

describe('sample scope', () => {
  it('takes ascii and ER fork-fixes, and flowchart, state and ER sources', () => {
    expect(inScope('ascii-x')).toBe(true)
    expect(inScope('er-ascii-x')).toBe(true)
    expect(inScope('class-x')).toBe(false)
    expect(isGraph('erDiagram\n A ||--o{ B : x')).toBe(true)
    expect(isGraph('stateDiagram-v2\n A --> B')).toBe(true)
    expect(isGraph('sequenceDiagram\n A->>B: hi')).toBe(false)
  })
})

describe('ER measure', () => {
  const src = `erDiagram
  A ||--o{ B : x
  A ||--o{ C : y
  A ||--o{ D : z`

  it('reads entity boxes off drawn text by label', () => {
    const text = '┌───┐ ┌───┐\n│ A │ │ B │\n└───┘ └───┘'
    const s = readErText(text, { A: 'A', B: 'B', Z: 'Z' })
    expect(Object.keys(s)).toEqual(['A', 'B'])
    expect(s.A!.main).toBe(0)
    expect(s.B!.cross).toBeGreaterThan(s.A!.cross)
  })

  it('ignores a border with no row under it and a repeated label', () => {
    const text = '┌───┐ ┌───┐\n│ A │ │ A │\n└───┘ └───┘\n┌───┐'
    const s = readErText(text, { A: 'A' })
    expect(Object.keys(s)).toEqual(['A'])
    expect(s.A!.cross).toBeLessThan(5)
  })

  it('scores a fan-out as exact, with layers and order counted', () => {
    const c = measureSample(src)
    expect(isExact(c)).toBe(true)
    expect(c.layerPairs).toBe(6)
    expect(c.orderPairs).toBe(3)
  })

  it('fails when the grid is fed an ER order swapped against ELK', () => {
    const swap = (h: AsciiLayoutHints): AsciiLayoutHints => {
      const nodes = new Map(h.nodes)
      for (const [id, n] of h.nodes)
        nodes.set(id, { ...n, order: -n.order, cross: -n.cross })
      return { ...h, nodes }
    }
    const c = measureEr(src, swap)
    expect(c.layerOk).toBe(c.layerPairs)
    expect(c.orderOk).toBeLessThan(c.orderPairs)
    expect(isExact(c)).toBe(false)
  })

  it('measures nothing for a side-by-side direction', () => {
    expect(
      measureEr(src.replace('erDiagram', 'erDiagram\n  direction LR')),
    ).toEqual(emptyCounts())
  })
})
