import { describe, expect, it } from 'vitest'
import type { MermaidGraph } from '@zombie-mermaid/core'
import { alignArchitectureRows } from '../layout-engine/architecture-rows.ts'

// Skip conditions of the architecture row pass, on hand-built boxes (#2473).
const box = (id: string, x: number, y: number) => ({
  id,
  label: id,
  shape: 'rectangle' as const,
  x,
  y,
  width: 80,
  height: 80,
})
const grp = (id: string, x: number, y: number) => ({
  id,
  label: id,
  x,
  y,
  width: 100,
  height: 100,
  children: [],
})
const graphOf = (...subgraphs: unknown[]) =>
  ({
    direction: 'LR',
    nodes: new Map([
      ['a', { id: 'a', gridOrder: 0 }],
      ['b', { id: 'b', gridOrder: 0 }],
    ]),
    edges: [{ source: 'a', target: 'b' }],
    subgraphs,
  }) as unknown as MermaidGraph
const s = (children: unknown[] = []) => ({ id: 's', nodeIds: ['b'], children })
const run = (
  graph: MermaidGraph,
  extra: ReturnType<typeof box>[],
  groups: ReturnType<typeof grp>[],
  aY = 100,
) => {
  const nodes = [box('a', 0, aY), box('b', 300, 200), ...extra]
  const moved = alignArchitectureRows(graph, nodes, [], groups)
  return { moved, b: nodes[1]! }
}

describe('architecture row alignment skips', () => {
  it('moves when nothing is in the way', () => {
    const r = run(graphOf(s()), [], [grp('s', 290, 190)])
    expect(r.moved).toBe(true)
    expect(r.b.y).toBe(100)
  })

  it('stays put when the shift would leave the canvas', () => {
    const r = run(graphOf(s()), [], [grp('s', 290, 190)], 0)
    expect(r.moved).toBe(false)
    expect(r.b.y).toBe(200)
  })

  it('stays put when a node sits where the group would land', () => {
    const r = run(graphOf(s()), [box('c', 300, 100)], [grp('s', 290, 190)])
    expect(r.moved).toBe(false)
  })

  it('stays put when another group sits where it would land', () => {
    const r = run(graphOf(s()), [], [grp('s', 290, 190), grp('other', 290, 90)])
    expect(r.moved).toBe(false)
  })

  it('ignores a subgraph with no drawn group', () => {
    const child = { id: 't', nodeIds: [], children: [] }
    expect(run(graphOf(s([child])), [], [grp('s', 290, 190)]).moved).toBe(true)
    expect(run(graphOf(s()), [], []).moved).toBe(false)
  })
})
