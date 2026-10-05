/**
 * #1350: edges that leave and arrive at the same node port (one cell on a
 * node's border) are drawn in their own columns instead of piled into one
 * corridor, while edges that share a port in the same direction (fan-out,
 * fan-in) keep sharing a trunk.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { convertToAsciiGraph } from '../converter.ts'
import { createMapping } from '../grid.ts'
import { portShifts } from '../port-offsets.ts'
import type { AsciiGraph } from '../types.ts'

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

const CORRIDOR = `graph TD
A -->|x| B
B -->|y| A
A --> D
B --> D`

describe('ASCII port offsets (#1350)', () => {
  it('moves an arriving edge off the column an outgoing edge leaves by', () => {
    const g = layout(CORRIDOR)
    const shifts = portShifts(g)
    // B --> A arrives at A's bottom port, where A --> B and A --> D leave.
    expect(shifts.get(edge(g, 'B', 'A'))?.end).toBeLessThan(0)
    // The leaving edges share one trunk (A --> D is bundled, so fixed), and
    // keep the routed column rather than moving individually.
    expect(shifts.has(edge(g, 'A', 'B'))).toBe(false)
    expect(shifts.has(edge(g, 'A', 'D'))).toBe(false)
  })

  it('draws the up arrow and the outgoing trunk in different columns', () => {
    const out = renderMermaidASCII(CORRIDOR, { colorMode: 'none' })
    const rows = out.split('\n')
    const border = rows.findIndex((r) => r.startsWith('└'))
    const below = rows[border + 1]!
    expect(below).toContain('▲')
    expect(below).toContain('│')
    expect(below.indexOf('▲')).not.toBe(below.indexOf('│'))
    // No stacked junctions on the border: the two strokes are apart.
    expect(rows[border]).not.toContain('┬┬')
  })

  it('separates the A/B corridor in the #1342 diagram', () => {
    const out = renderMermaidASCII(
      `graph TD
A -->|x| B
B -->|long label| A
A -->|long label| C
C -->|ab| A
B -->|mid| D
A -->|ab| D
D -->|x| A`,
      { colorMode: 'none' },
    )
    const rows = out.split('\n')
    const border = rows.findIndex((r) => /^└.*┬/.test(r))
    expect(border).toBeGreaterThan(0)
    // Under A: the up arrow into A and the down trunk are separate columns.
    const below = rows[border + 1]!
    expect(below.indexOf('▲')).toBeGreaterThanOrEqual(0)
    expect(below.indexOf('│')).toBeGreaterThan(below.indexOf('▲') + 1)
    // The border carries one junction for the leaving trunk, not a pair.
    expect(rows[border]!.match(/┬/g)).toHaveLength(1)
  })

  it('leaves a port used one way only on its routed column', () => {
    expect(portShifts(layout('graph TD\nA --> B\nA --> C\nB --> D')).size).toBe(
      0,
    )
  })

  it('leaves a lone reciprocal pair to the #1284 stroke shift', () => {
    const g = layout('graph TD\nA -->|x| B\nB -->|y| A')
    expect(portShifts(g).size).toBe(0)
  })
})
