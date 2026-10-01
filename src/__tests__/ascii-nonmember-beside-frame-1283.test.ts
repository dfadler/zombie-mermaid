/**
 * Regression tests for #1283 — layout of a non-member node placed beside a
 * subgraph frame (follow-up to #1252/#1278).
 *
 * `separateNonMembersFromFrames` re-places `Y` just past the frame, but left
 * its parent `W` where it was, so `W --> Y` wrapped around from W's side
 * instead of dropping straight down. A free-standing parent that only feeds
 * the moved node now moves to the same column.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../parser.ts'
import { convertToAsciiGraph } from '../../packages/ascii-renderer/src/converter.ts'
import { createMapping } from '../../packages/ascii-renderer/src/grid.ts'
import type {
  AsciiConfig,
  AsciiGraph,
} from '../../packages/ascii-renderer/src/types.ts'

function layout(source: string, direction: 'TD' | 'LR'): AsciiGraph {
  const config: AsciiConfig = {
    useAscii: false,
    paddingX: 5,
    paddingY: 5,
    boxBorderPadding: 1,
    graphDirection: direction,
  }
  const graph = convertToAsciiGraph(parseMermaid(source), config)
  createMapping(graph)
  return graph
}

function grid(graph: AsciiGraph, name: string) {
  const gc = graph.nodes.find((n) => n.name === name)?.gridCoord
  if (!gc) throw new Error(`node ${name} not placed`)
  return gc
}

describe('ASCII: a non-member moved off a frame keeps its parent aligned (#1283)', () => {
  it('keeps W directly above Y in TD', () => {
    const graph = layout(
      `graph TD
X-->Sub
W-->Y
Y-->Sub
subgraph Sub
A-->B
A-->C
end`,
      'TD',
    )
    expect(grid(graph, 'W').x).toBe(grid(graph, 'Y').x)
    expect(grid(graph, 'W').y).toBeLessThan(grid(graph, 'Y').y)
    const edge = graph.edges.find(
      (e) => e.from.name === 'W' && e.to.name === 'Y',
    )!
    // A straight drop: every path point shares one column.
    expect(new Set(edge.path.map((p) => p.x)).size).toBe(1)
  })

  it('keeps W level with Y in LR', () => {
    const graph = layout(
      `graph LR
X-->Sub
W-->Y
Y-->Sub
subgraph Sub
A-->B
A-->C
end`,
      'LR',
    )
    expect(grid(graph, 'W').y).toBe(grid(graph, 'Y').y)
  })
})
