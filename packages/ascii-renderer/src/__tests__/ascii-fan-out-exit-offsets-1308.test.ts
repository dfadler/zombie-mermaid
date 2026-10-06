/**
 * #1308: edges that leave one node port in the same direction and bend the
 * same way at different distances each get a stem of their own, instead of the
 * nearer bend riding the whole stem of the farther one. Edges that bend at the
 * same distance, or the other way, keep sharing a trunk.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { convertToAsciiGraph } from '../converter.ts'
import { createMapping } from '../grid.ts'
import { portShifts, staggerFanOuts } from '../port-offsets.ts'
import type { FanOutMember, PortRun } from '../port-offsets.ts'
import type { AsciiEdge, AsciiGraph } from '../types.ts'

function layout(source: string): AsciiGraph {
  const graph = convertToAsciiGraph(parseMermaid(source), {
    useAscii: false,
    paddingX: 5,
    paddingY: 5,
    boxBorderPadding: 1,
    graphDirection: 'LR',
  })
  createMapping(graph)
  return graph
}

const edge = (g: AsciiGraph, from: string, to: string): AsciiEdge =>
  g.edges.find((e) => e.from.name === from && e.to.name === to)!

const BRANCHING = `graph LR
  A[main] --> B[develop]
  B --> C[feature/auth]
  B --> D[feature/ui]
  C --> E{PR Review}
  D --> E
  E -->|approved| B
  B --> F[release/1.0]
  F --> G{Tests?}
  G -->|pass| A
  G -->|fail| F`

const THREE_BENDS = `graph LR
  Source --> T
  Source --> M
  Source --> B
  Source --> C`

/** The start run of an edge that leaves its source going down, then right. */
function downThenRight(e: AsciiEdge, straight = false): FanOutMember {
  const p = e.path
  const run: PortRun = {
    axis: 'v',
    line: p[0]!.x,
    from: 0,
    to: 1,
    side: 'bottom',
    node: e.from,
    cell: p[0]!,
    turn: straight ? 0 : 1,
  }
  return { edge: e, run, straight }
}

describe('ASCII fan-out exit offsets (#1308)', () => {
  it('gives the two edges leaving develop downward a stem each', () => {
    const g = layout(BRANCHING)
    const ui = portShifts(g).get(edge(g, 'B', 'D'))!
    const release = portShifts(g).get(edge(g, 'B', 'F'))!
    // The farther bend (release) keeps the port's slot, the nearer one (ui)
    // steps one stroke spacing toward the side it bends to.
    expect(ui.start - release.start).toBe(2)
  })

  it('draws two junctions under develop and one stem per branch', () => {
    const rows = renderMermaidASCII(BRANCHING, { colorMode: 'none' }).split(
      '\n',
    )
    const border = rows.findIndex((r) => r.includes('└─────┬─┬─┘'))
    expect(border).toBeGreaterThan(0)
    const stems = [...rows[border + 1]!.matchAll(/│/g)].map((m) => m.index)
    // Two stems below develop (plus the main loop-back column further left).
    const col = rows[border]!.indexOf('┬')
    expect(stems).toContain(col)
    expect(stems).toContain(col + 2)
    // feature/ui is entered from its own stem, release/1.0 from the other.
    const uiRow = rows.findIndex((r) => r.includes('└───────►│  feature/ui'))
    expect(uiRow).toBeGreaterThan(border)
    expect(rows[uiRow]!.indexOf('└')).toBe(col + 2)
  })

  it('keeps edges that bend at the same distance on one trunk', () => {
    const g = layout('graph LR\nA --> B\nA --> C')
    expect(portShifts(g).size).toBe(0)
  })

  it('leaves a fan-out whose stems would not fit the node border sharing a trunk', () => {
    const g = layout(THREE_BENDS)
    for (const to of ['M', 'B', 'C']) {
      expect(portShifts(g).has(edge(g, 'Source', to))).toBe(false)
    }
  })

  describe('staggerFanOuts', () => {
    const g = layout(BRANCHING)
    const members = (): FanOutMember[] => [
      downThenRight(edge(g, 'B', 'D')),
      downThenRight(edge(g, 'B', 'F')),
    ]

    it('steps each nearer bend toward the side it bends to', () => {
      const out = new Map<AsciiEdge, number>()
      staggerFanOuts(g, members(), 1, [], out)
      expect(out.get(edge(g, 'B', 'F'))).toBe(1)
      expect(out.get(edge(g, 'B', 'D'))).toBe(3)
    })

    it('keeps a straight edge out of the same port on the base stem', () => {
      const out = new Map<AsciiEdge, number>()
      const straight = downThenRight(edge(g, 'B', 'F'), true)
      staggerFanOuts(
        g,
        [straight, downThenRight(edge(g, 'B', 'D'))],
        0,
        [],
        out,
      )
      expect(out.has(edge(g, 'B', 'F'))).toBe(false)
      expect(out.get(edge(g, 'B', 'D'))).toBe(2)
    })

    it('does not compare edges that leave different sides of one cell', () => {
      const out = new Map<AsciiEdge, number>()
      const [a, b] = members()
      // Same port cell, same turn, different bend distances, but the second
      // edge leaves through the top side: they share no stem.
      const other: FanOutMember = { ...b!, run: { ...b!.run, side: 'top' } }
      staggerFanOuts(g, [a!, other], 1, [], out)
      expect(out.size).toBe(0)
      // A straight edge anchors only the side it leaves through.
      const straightTop: FanOutMember = {
        ...downThenRight(edge(g, 'B', 'F'), true),
      }
      straightTop.run = { ...straightTop.run, side: 'top' }
      staggerFanOuts(g, [straightTop, a!], 1, [], out)
      expect(out.size).toBe(0)
    })

    it('leaves the group sharing when the node has no drawing to attach to', () => {
      const out = new Map<AsciiEdge, number>()
      const bare = (m: FanOutMember): FanOutMember => {
        const node = { ...m.run.node, drawingCoord: null }
        return { ...m, run: { ...m.run, node } }
      }
      staggerFanOuts(g, members().map(bare), 1, [], out)
      expect(out.size).toBe(0)
    })

    it('leaves the group sharing when a stem would land on another edge', () => {
      const out = new Map<AsciiEdge, number>()
      // Another edge at this port sits where the nearer bend would go.
      staggerFanOuts(g, members(), 1, [2], out)
      expect(out.size).toBe(0)
      staggerFanOuts(g, members(), 1, [-1], out)
      expect(out.size).toBe(2)
    })
  })
})
