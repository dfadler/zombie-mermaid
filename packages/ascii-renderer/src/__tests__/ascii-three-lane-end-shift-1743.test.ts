/**
 * Guards of the plain (non-cluster) branch of `clusterLaneEndShift` (#1743):
 * only the third of exactly three lanes whose final run heads left is shifted.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { clusterLaneEndShift } from '../cluster-boundary.ts'
import { convertToAsciiGraph } from '../converter.ts'
import { createMapping } from '../grid.ts'
import type { AsciiSubgraph } from '../types.ts'

const build = (lanes: number) => {
  // Long labels keep the lanes (short ones are drawn side by side instead).
  const edges = ['first', 'second', 'third', 'fourth']
    .slice(0, lanes)
    .map((label) => `  A -->|${label}| B`)
    .join('\n')
  const graph = convertToAsciiGraph(
    parseMermaid(`flowchart TD\n  Start --> A\n${edges}\n`),
    {
      useAscii: false,
      paddingX: 6,
      paddingY: 5,
      boxBorderPadding: 1,
      graphDirection: 'TD',
    },
  )
  createMapping(graph)
  const last = graph.edges.find((e) => e.parallelLane?.index === 2)!
  return { graph, last }
}

describe('clusterLaneEndShift, plain third lane (#1743)', () => {
  it('shifts the third of three lanes whose last run heads left', () => {
    const { graph, last } = build(3)
    expect(clusterLaneEndShift(graph, last)).toBe(1)
  })

  it('does not shift when there are four lanes', () => {
    const { graph, last } = build(4)
    expect(clusterLaneEndShift(graph, last)).toBe(0)
  })

  it('does not shift an edge that touches a cluster', () => {
    const { graph, last } = build(3)
    last.clusterSource = {} as AsciiSubgraph
    expect(clusterLaneEndShift(graph, last)).toBe(0)
    delete last.clusterSource
    last.clusterTarget = {} as AsciiSubgraph
    expect(clusterLaneEndShift(graph, last)).toBe(0)
  })

  it('does not shift unless the last run is horizontal and heads left', () => {
    const { graph, last } = build(3)
    const orig = last.path
    const a = orig[orig.length - 2]!
    last.path = [...orig.slice(0, -1), { x: a.x, y: a.y + 1 }]
    expect(clusterLaneEndShift(graph, last)).toBe(0)
    last.path = [...orig.slice(0, -1), { x: a.x + 3, y: a.y }]
    expect(clusterLaneEndShift(graph, last)).toBe(0)
    last.path = []
    expect(clusterLaneEndShift(graph, last)).toBe(0)
  })
})
