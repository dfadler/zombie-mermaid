/**
 * #2492 guards in port-offsets.ts: paths whose first or last segment is not
 * axis-aligned have no run, and nested L edges that tie on every key are left
 * to the default push.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { convertToAsciiGraph } from '../converter.ts'
import { createMapping } from '../grid.ts'
import {
  farPush,
  nestedPush,
  nestedRow,
  portShifts,
  type PortRun,
  type Slot,
} from '../port-offsets.ts'
import type { AsciiEdge, AsciiGraph, AsciiNode } from '../types.ts'

function layout(): AsciiGraph {
  const graph = convertToAsciiGraph(
    parseMermaid('graph TD\nA --> B\nB --> C'),
    {
      useAscii: false,
      paddingX: 5,
      paddingY: 5,
      boxBorderPadding: 1,
      graphDirection: 'TD',
    },
  )
  createMapping(graph)
  return graph
}

const DIAGONAL_FIRST = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
  { x: 1, y: 3 },
]
const DIAGONAL_LAST = [
  { x: 0, y: 0 },
  { x: 0, y: 2 },
  { x: 1, y: 3 },
]

describe('opposing-edge guards (#2492)', () => {
  it.each([[DIAGONAL_FIRST], [DIAGONAL_LAST]])(
    'skips the end of a path that has no run, routed or fixed',
    (path) => {
      for (const fixed of [false, true]) {
        const g = layout()
        const edge = g.edges[0]!
        edge.path = path
        if (fixed)
          edge.parallelLane = { index: 0, total: 1, usedOffsets: new Set() }
        expect(() => portShifts(g)).not.toThrow()
      }
    },
  )

  it('gives a far end with no run the neutral push', () => {
    const edge = { path: DIAGONAL_FIRST } as AsciiEdge
    expect(farPush(edge, 'E')).toBe(0)
    expect(farPush({ path: DIAGONAL_LAST } as AsciiEdge, 'S')).toBe(0)
  })

  const run = (turn: -1 | 1): PortRun => ({
    axis: 'v',
    line: 0,
    from: 0,
    to: 1,
    side: 'bottom',
    node: {} as AsciiNode,
    cell: { x: 0, y: 0 },
    turn,
  })
  const slot = (
    role: 'S' | 'E',
    turn: -1 | 1,
    far: number,
    lane?: number,
    down = 1,
  ): Slot => ({
    run: run(turn),
    role,
    fixed: false,
    elbow: true,
    extent: 2,
    far,
    lane,
    down,
  })
  const same = (): string => 'port'

  it('leaves a tie on distance and far row to the default push', () => {
    const slots = new Map([
      ['a', slot('S', 1, 0)],
      ['b', slot('E', -1, 0)],
    ])
    expect(nestedPush(slots, 'a', same)).toBeUndefined()
  })

  it('breaks a distance tie by the far row', () => {
    const slots = new Map([
      ['a', slot('S', 1, -1)],
      ['b', slot('E', -1, 1)],
    ])
    expect(nestedPush(slots, 'a', same)).toBe(1)
    expect(nestedPush(slots, 'b', same)).toBe(-1)
  })

  it('gives nestedRow no row for an edge without a lane or a partner', () => {
    const lone = new Map([['a', slot('S', 1, 0)]])
    expect(nestedRow(lone, 'a', same)).toBeUndefined()
    const noLane = new Map([
      ['a', slot('S', 1, 0, 3)],
      ['b', slot('E', -1, 0)],
    ])
    expect(nestedRow(noLane, 'a', same)).toBeUndefined()
    const tie = new Map([
      ['a', slot('S', 1, 0, 3)],
      ['b', slot('E', -1, 0, 3)],
    ])
    expect(nestedRow(tie, 'a', same)).toBeUndefined()
    const sameRole = new Map([
      ['a', slot('S', 1, 0, 3)],
      ['b', slot('S', -1, 0, 5)],
    ])
    expect(nestedRow(sameRole, 'a', same)).toBeUndefined()
    const apart = new Map([
      ['a', slot('S', 1, 0, 3)],
      ['b', slot('E', -1, 0, 5)],
    ])
    expect(nestedRow(apart, 'a', (k) => k)).toBeUndefined()
  })

  it('gives the farther-left lane the lower row going down, the upper going up', () => {
    const slots = (down: number) =>
      new Map([
        ['a', slot('S', 1, 0, 3, down)],
        ['b', slot('E', -1, 0, 5, down)],
      ])
    expect(nestedRow(slots(1), 'a', same)).toBe(1)
    expect(nestedRow(slots(1), 'b', same)).toBe(-1)
    expect(nestedRow(slots(-1), 'a', same)).toBe(-1)
    expect(nestedRow(slots(-1), 'b', same)).toBe(1)
  })
})
