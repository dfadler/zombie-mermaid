/**
 * #1349: a reciprocal pair (`A --> C` and `C --> A`) whose routes are a
 * straight line or a single bend may share cells, because port-offsets.ts
 * draws their strokes apart at the ports. Treating the pair as a chain made
 * the second edge detour round the far side of the diagram.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { convertToAsciiGraph } from '../converter.ts'
import { createMapping } from '../grid.ts'
import { pathCells } from '../grid-occupancy.ts'
import { gridKey, type AsciiGraph } from '../types.ts'

function layout(source: string): AsciiGraph {
  const graph = convertToAsciiGraph(parseMermaid(source), {
    useAscii: false,
    paddingX: 5,
    paddingY: 5,
    boxBorderPadding: 1,
    graphDirection: 'TD',
  })
  createMapping(graph)
  return graph
}

const edge = (g: AsciiGraph, from: string, to: string) =>
  g.edges.find((e) => e.from.name === from && e.to.name === to)!

const DENSE = `graph TD
A -->|x| B
B -->|long label| A
A -->|long label| C
C -->|ab| A
B -->|mid| D
A -->|ab| D
D -->|x| A`

describe('ASCII reciprocal pair routing (#1349)', () => {
  it('routes the return edge of a single-bend pair as one bend, not a wrap', () => {
    const g = layout(DENSE)
    // A --> C leaves A's right and drops into C: one bend, three points.
    expect(edge(g, 'A', 'C').path).toHaveLength(3)
    // C --> A is the same route reversed, not a staircase round the far side.
    expect(edge(g, 'C', 'A').path).toHaveLength(3)
  })

  it('keeps the pair on cells port-offsets.ts draws apart', () => {
    const out = layout(DENSE)
    const ac = edge(out, 'A', 'C').path
    const ca = edge(out, 'C', 'A').path
    expect(ca.map((p) => `${p.x},${p.y}`)).toEqual(
      [...ac].reverse().map((p) => `${p.x},${p.y}`),
    )
  })

  it('still keeps a reciprocal pair with a long route off each other', () => {
    // A <-> D passes B, so the routes are long; their middle stretch is not a
    // port run and nothing draws it apart, so they must not share cells.
    const g = layout(DENSE)
    const ad = new Set(pathCells(edge(g, 'A', 'D').path).map(gridKey))
    const da = pathCells(edge(g, 'D', 'A').path).map(gridKey)
    expect(da.filter((k) => ad.has(k))).toEqual([])
  })

  it('draws both edges of the pair, each with its own arrowhead', () => {
    const out = layout(DENSE)
    expect(edge(out, 'A', 'C').hasArrowEnd).toBe(true)
    expect(edge(out, 'C', 'A').hasArrowEnd).toBe(true)
  })
})
