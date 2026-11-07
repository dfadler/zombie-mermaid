import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import {
  describeSample,
  addCounts,
  compareFaces,
  compareSpots,
  emptyCounts,
  isExact,
  measureSample,
  readGrid,
} from '../scripts/lib/ascii-topology.ts'
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
