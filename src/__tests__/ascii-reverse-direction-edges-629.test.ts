/**
 * Regression tests for #629: the reverse-direction half of #329.
 *
 * #329 fixed two edges running the *same* way between one pair of nodes
 * (`A -->|One| B` twice) by giving every edge past the first its own offset
 * lane. That fix keyed its grouping on the **ordered** pair
 * `(source, target)`, so `Browser --> Server` and `Server --> Browser`
 * landed in two different groups and neither was ever tagged as a sibling
 * of the other. Both then routed through the same horizontal channel and
 * reproduced #329's original defect byte for byte:
 *
 *   ┌─────────┐          ┌────────┐
 *   │ Browser ├rrequest─►┤ Server │      <- "request"/"response" composited
 *   └─────────┘          └────────┘         and one arrowhead dropped
 *
 * The fix (edge-routing.ts): `parallelGroupKey` orders the two node names
 * so a reciprocal pair shares one group — but only when the two nodes are
 * laid out side by side on the same grid row (`sharesHorizontalChannel`),
 * which is the layout where they actually collide. A *vertically* stacked
 * reciprocal pair is deliberately left in separate groups: draw-arrows.ts's
 * `drawTextOnLine` already pulls each of those labels into its own half of
 * the shared vertical segment (#530), and that mechanism only works on a
 * vertical segment, so routing one of the two through a lane would take it
 * out of play. `determinePath` additionally swaps in the *alternative*
 * start/end direction pair for a lane edge whose preferred pair is
 * degenerate (same face on both ends, e.g. Down/Down for a backwards LR
 * edge), a shape `buildParallelLanePath`'s offset math cannot express.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../parser.ts'
import { convertToAsciiGraph } from '../../packages/ascii-renderer/src/converter.ts'
import { createMapping } from '../../packages/ascii-renderer/src/grid.ts'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { pathCells } from '../../packages/ascii-renderer/src/grid-occupancy.ts'
import type {
  AsciiConfig,
  AsciiEdge,
  AsciiGraph,
} from '../../packages/ascii-renderer/src/types.ts'

const RIGHT_ARROW = '►'
const LEFT_ARROW = '◄'
const UP_ARROW = '▲'
const DOWN_ARROW = '▼'

function render(source: string): string {
  return renderMermaidASCII(source, { colorMode: 'none' })
}

function buildGraph(source: string, graphDirection: 'LR' | 'TD'): AsciiGraph {
  const parsed = parseMermaid(source)
  const config: AsciiConfig = {
    useAscii: false,
    paddingX: 5,
    paddingY: 5,
    boxBorderPadding: 1,
    graphDirection,
  }
  const graph = convertToAsciiGraph(parsed, config)
  createMapping(graph)
  return graph
}

function edgeBetween(
  graph: AsciiGraph,
  fromName: string,
  toName: string,
): AsciiEdge {
  const edge = graph.edges.find(
    (e) => e.from.name === fromName && e.to.name === toName,
  )
  if (!edge) throw new Error(`no ${fromName} --> ${toName} edge in graph`)
  return edge
}

function cellKey(c: { x: number; y: number }): string {
  return `${c.x},${c.y}`
}

/** Total arrowheads drawn, in any of the four glyph directions. */
function countArrowheads(out: string): number {
  return [...out].filter((ch) =>
    [RIGHT_ARROW, LEFT_ARROW, UP_ARROW, DOWN_ARROW].includes(ch),
  ).length
}

const BOTH_LABELLED = `graph LR
  Browser -- request --> Server
  Server -- response --> Browser`

describe('opposite-direction edges between one node pair (#629)', () => {
  it('the exact issue repro: both labels render intact and uncorrupted', () => {
    const out = render(BOTH_LABELLED)

    expect(out).toContain('request')
    expect(out).toContain('response')
    // The reported corruption: "response"'s leading "r" landing on the cell
    // before "request"'s own, so neither word is recoverable.
    expect(out).not.toContain('rrequest')
  })

  it('the exact issue repro: both arrowheads survive', () => {
    const out = render(BOTH_LABELLED)

    // Two declared edges, so two arrowheads — the issue's defect #2 was
    // that only one was drawn, making the pair read as one-way.
    expect(countArrowheads(out)).toBe(2)
  })

  it('the exact issue repro: the two edges occupy different rows', () => {
    const rows = render(BOTH_LABELLED).split('\n')
    const requestRow = rows.findIndex((r) => r.includes('request'))
    const responseRow = rows.findIndex((r) => r.includes('response'))

    expect(requestRow).toBeGreaterThan(-1)
    expect(responseRow).toBeGreaterThan(-1)
    // The issue's defect #3: one shared row, so nothing in the output
    // indicated the source had declared two edges.
    expect(requestRow).not.toBe(responseRow)
  })

  it('only the forward edge labelled: label intact, edges kept apart', () => {
    const source = `graph LR
  Browser -- request --> Server
  Server --> Browser`
    const out = render(source)

    expect(out).toContain('request')
    expect(countArrowheads(out)).toBe(2)
    // Before the fix these two rendered as a single `◄request►` line, which
    // reads as one bidirectional edge labelled "request" rather than a
    // labelled edge plus an unlabelled one — so assert they were actually
    // separated, not just that two arrowheads survived.
    const graph = buildGraph(source, 'LR')
    expect(edgeBetween(graph, 'Browser', 'Server').parallelLane?.index).toBe(0)
    expect(edgeBetween(graph, 'Server', 'Browser').parallelLane?.index).toBe(1)
  })

  it('only the reverse edge labelled: label intact, both arrowheads drawn', () => {
    const out = render(`graph LR
  Browser --> Server
  Server -- response --> Browser`)

    expect(out).toContain('response')
    // This orientation dropped the reverse edge's own `◄` before the fix.
    expect(countArrowheads(out)).toBe(2)
  })

  it('a chain of two opposed pairs keeps all four labels', () => {
    const out = render(`graph LR
  A -- a1 --> B
  B -- b1 --> A
  B -- b2 --> C
  C -- c1 --> B`)

    // b1 and c1 vanished entirely before the fix — each was drawn onto the
    // cells its forward partner had already claimed.
    for (const label of ['a1', 'b1', 'b2', 'c1']) {
      expect(out).toContain(label)
    }
    expect(countArrowheads(out)).toBe(4)
  })

  it('routes the reciprocal pair through distinct, non-identical paths', () => {
    const graph = buildGraph(BOTH_LABELLED, 'LR')
    const forward = edgeBetween(graph, 'Browser', 'Server')
    const reverse = edgeBetween(graph, 'Server', 'Browser')

    const forwardCells = new Set(forward.path.flatMap((c) => cellKey(c)))
    expect(reverse.path.map(cellKey).some((k) => !forwardCells.has(k))).toBe(
      true,
    )
  })

  it('gives the reciprocal pair non-overlapping label lines', () => {
    const graph = buildGraph(BOTH_LABELLED, 'LR')
    const forward = edgeBetween(graph, 'Browser', 'Server')
    const reverse = edgeBetween(graph, 'Server', 'Browser')

    const forwardCells = new Set(pathCells(forward.labelLine).map(cellKey))
    const overlap = pathCells(reverse.labelLine)
      .map(cellKey)
      .filter((k) => forwardCells.has(k))
    expect(overlap).toEqual([])
  })

  it('keeps the reverse edge’s lane between its own two nodes', () => {
    const graph = buildGraph(BOTH_LABELLED, 'LR')
    const reverse = edgeBetween(graph, 'Server', 'Browser')
    const from = reverse.from.gridCoord!
    const to = reverse.to.gridCoord!
    // A node's reserved block spans 3 grid columns from its own x.
    const minX = Math.min(from.x, to.x)
    const maxX = Math.max(from.x, to.x) + 2

    // determineStartAndEndDir hands a backwards LR edge a degenerate
    // Down/Down pair — leave and re-enter on the same (bottom) face —
    // which buildParallelLanePath's offset math reads as a *vertical*
    // departure and so offsets by column. That pushes the lane, and its
    // label with it, out past the right-hand node instead of down into the
    // channel below the pair, and drags the horizontal jogs across both
    // nodes' own bottom border rows on the way. determinePath swaps in the
    // alternative straight-through pair to avoid exactly this.
    for (const point of reverse.labelLine) {
      expect(point.x).toBeGreaterThanOrEqual(minX)
      expect(point.x).toBeLessThanOrEqual(maxX)
    }
  })

  it('tags exactly one of the two as a lane edge', () => {
    const graph = buildGraph(BOTH_LABELLED, 'LR')
    const forward = edgeBetween(graph, 'Browser', 'Server')
    const reverse = edgeBetween(graph, 'Server', 'Browser')

    // Same group, so index 0 keeps the ordinary center path and index 1
    // gets the offset lane.
    expect(forward.parallelLane?.index).toBe(0)
    expect(reverse.parallelLane?.index).toBe(1)
    expect(reverse.parallelLane?.total).toBe(2)
  })

  it('never folds a lane-assigned edge into a fan-in/fan-out bundle', () => {
    // Side-by-side siblings B and C with an edge each way between them, in
    // a TD graph (the only direction analyzeEdgeBundles bundles at all), so
    // both a lane group and bundle groups exist over the same edges.
    const graph = buildGraph(
      `graph TD
  A --> B
  A --> C
  B -- x --> C
  C -- y --> B`,
      'TD',
    )

    expect(edgeBetween(graph, 'B', 'C').parallelLane).toBeDefined()
    const bundled = (graph.bundles ?? []).flatMap((b) => b.edges)
    expect(bundled.filter((e) => e.parallelLane)).toEqual([])
  })

  it('leaves a vertically stacked reciprocal pair on the #530 mechanism', () => {
    const graph = buildGraph(
      `graph TD
  A -- down --> B
  B -- up --> A`,
      'TD',
    )

    // Stacked in one column, not side by side: drawTextOnLine already
    // separates these two labels, so no lane is assigned (a lane here would
    // route one of them out of the shared vertical segment and disable it).
    expect(edgeBetween(graph, 'A', 'B').parallelLane).toBeUndefined()
    expect(edgeBetween(graph, 'B', 'A').parallelLane).toBeUndefined()

    const out = render(`graph TD
  A -- down --> B
  B -- up --> A`)
    expect(out).toContain('down')
    expect(out).toContain('up')
    expect(out).toContain(UP_ARROW)
    expect(out).toContain(DOWN_ARROW)
  })

  it('leaves a single `<-->` bidirectional edge merged onto one line', () => {
    const out = render(`graph LR
  A <--> B`)

    // One declared edge, drawn as one line with a head at each end — this
    // is a different code path from the per-edge lane assignment and must
    // stay untouched.
    expect(out).toContain(`${LEFT_ARROW}────${RIGHT_ARROW}`)
  })
})
