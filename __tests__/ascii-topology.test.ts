import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import {
  describeSample,
  addCounts,
  compareFaces,
  compareSpots,
  emptyCounts,
  inScope,
  isExact,
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
