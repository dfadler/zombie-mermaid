/**
 * #1284: `strokeShift` only draws a reciprocal vertical pair apart when
 * nothing else is in the way. Real input rarely reaches the "stay centred"
 * exits (layout widens the pair's column and the nodes to fit the labels,
 * and a pair edge never has a cluster-exit/entry route of its own), so these
 * tests build the laid-out graph and set up each blocking condition on it
 * directly, asserting `strokeShift` falls back to 0 only because of it.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { convertToAsciiGraph } from '../converter.ts'
import { createMapping, gridToDrawingCoord } from '../grid.ts'
import { edgeLabelPlacement, strokeShift } from '../draw-arrows.ts'
import type { AsciiEdge, AsciiGraph } from '../types.ts'

function layout(source: string): AsciiGraph {
  const graph = convertToAsciiGraph(parseMermaid(source), {
    useAscii: false,
    paddingX: 6,
    paddingY: 5,
    boxBorderPadding: 1,
    graphDirection: 'TD',
  })
  createMapping(graph)
  return graph
}

const PAIR = `graph TD
A -->|a long down label| B
B -->|up| A`

function pair(graph: AsciiGraph): { down: AsciiEdge; up: AsciiEdge } {
  const down = graph.edges.find((e) => e.from.name === 'A')
  const up = graph.edges.find((e) => e.from.name === 'B')
  if (!down || !up) throw new Error('pair edges missing')
  return { down, up }
}

describe('strokeShift keeps a reciprocal pair centred when something blocks the labels (#1284)', () => {
  it('shifts the unobstructed pair (baseline for the cases below)', () => {
    const graph = layout(PAIR)
    const { down, up } = pair(graph)
    expect(strokeShift(graph, down)).toBe(1)
    expect(strokeShift(graph, up)).toBe(-1)
  })

  it('stays centred when a node box covers the label cells', () => {
    const graph = layout(PAIR)
    const { down, up } = pair(graph)
    expect(strokeShift(graph, down)).toBe(1)
    const [label] = edgeLabelPlacement(graph, down)!
    // B is a real, placed node; move its box onto the down label's first cell.
    expect(down.to.drawing).not.toBeNull()
    down.to.drawingCoord = { x: label!.x, y: label!.y }
    expect(strokeShift(graph, down)).toBe(0)
    expect(strokeShift(graph, up)).toBe(0)
  })

  it('stays centred when another edge runs through the label cells', () => {
    const graph = layout(PAIR)
    const { down, up } = pair(graph)
    expect(strokeShift(graph, down)).toBe(1)
    const [label] = edgeLabelPlacement(graph, down)!
    // A third edge whose bounding box (one diagonal leg, from beside the
    // source to beside the target) spans the down label's cell.
    const start = down.path[0]!
    const end = down.path[1]!
    const crossing: AsciiEdge = {
      ...up,
      text: '',
      path: [
        { x: start.x - 1, y: start.y },
        { x: start.x + 4, y: end.y },
      ],
    }
    const [a, b] = crossing.path.map((c) => gridToDrawingCoord(graph, c))
    expect(Math.min(a!.y, b!.y)).toBeLessThanOrEqual(label!.y)
    expect(Math.max(a!.y, b!.y)).toBeGreaterThanOrEqual(label!.y)
    expect(Math.min(a!.x, b!.x)).toBeLessThanOrEqual(label!.x)
    expect(Math.max(a!.x, b!.x)).toBeGreaterThanOrEqual(label!.x)
    graph.edges.push(crossing)
    expect(strokeShift(graph, down)).toBe(0)
    expect(strokeShift(graph, up)).toBe(0)
  })

  it('stays centred when either edge is a cluster-exit edge', () => {
    const graph = layout(`graph TD
subgraph S
  A
end
A --> B
B --> A`)
    const { down, up } = pair(graph)
    expect(strokeShift(graph, down)).toBe(1)
    const sg = graph.subgraphs[0]!
    down.clusterSource = sg
    graph.clusterExitPlans = new Map([
      [
        sg,
        {
          box: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
          anchor: down.from,
          gutter: { x: 0, y: 0 },
          edges: new Set([down]),
        },
      ],
    ])
    expect(strokeShift(graph, down)).toBe(0)
    // The partner sees the same pair, so it stays centred too.
    expect(strokeShift(graph, up)).toBe(0)
  })
})
