/**
 * Regression/coverage test for the deepest fallback tier of
 * `determineLabelLine` (src/ascii/edge-routing.ts) — the one that runs when
 * *no* segment is both wide enough for the label and clear of nodes, so it
 * falls back to `clearLaterSegments` (non-terminal segments clear of
 * nodes), then `clearSegments` (any segment clear of nodes, terminal or
 * not), then finally every segment regardless.
 *
 * Exercises two branches #450's fix introduced that the rest of the suite
 * never reaches on their own:
 *
 *  - A non-terminal segment (touching neither the source's nor the
 *    target's own border) that still fails `clearOfNodes` because its
 *    interior runs through an unrelated node's block — so
 *    `!isTerminalSegment(s) && clearOfNodes(s.line)` evaluates the right
 *    operand and gets `false` from it, rather than short-circuiting on a
 *    terminal segment (the only case the rest of the suite happens to hit).
 *  - `clearLaterSegments` ending up non-empty, so the ternary at
 *    `determineLabelLine` uses it directly instead of falling through to
 *    `clearSegments`.
 *
 * The two terminal segments are deliberately given a *larger* combined
 * column width than the middle (non-terminal) one, all still under the
 * label's length. This matters for the second test below: with the
 * terminal exclusion removed (the mutation a sabotage check should catch),
 * `clearLaterSegments` would include the terminal segments too, and being
 * wider they'd win the width-descending sort — silently picking a
 * box-border-adjacent segment instead of the safe middle one, the exact
 * class of bug #450 was filed against. Equal widths would let the middle
 * segment win the tie-break by filter order alone, masking that mutation.
 *
 * Constructed directly against `determineLabelLine` (bypassing the parser
 * and full grid layout, following the same pattern as
 * ascii-edge-routing-single-point-path.test.ts) so the exact segment/label
 * widths and the blocked cell can be pinned precisely, rather than hoping
 * some real diagram happens to hit this deep a fallback tier.
 */
import { describe, it, expect } from 'vitest'
import { determineLabelLine } from '../ascii/edge-routing.ts'
import { Down, gridKey } from '../ascii/types.ts'
import type { AsciiEdge, AsciiGraph, AsciiNode } from '../ascii/types.ts'
import { createGrid } from '../ascii/grid-occupancy.ts'

function makeNode(name: string, x: number, y: number): AsciiNode {
  return {
    name,
    displayLabel: name,
    shape: 'rectangle',
    index: 0,
    gridCoord: { x, y },
    drawingCoord: null,
    drawing: null,
    drawn: false,
    styleClassName: '',
    styleClass: { name: '', styles: {} },
  }
}

function makeGraph(nodes: AsciiNode[]): AsciiGraph {
  return {
    nodes,
    edges: [],
    canvas: [],
    roleCanvas: [],
    grid: createGrid(),
    columnWidth: new Map(),
    rowHeight: new Map(),
    subgraphs: [],
    config: {
      useAscii: false,
      paddingX: 5,
      paddingY: 5,
      boxBorderPadding: 1,
      graphDirection: 'TD',
    },
    offsetX: 0,
    offsetY: 0,
    bundles: [],
  }
}

/**
 * Shared path/width setup for both tests: a 3-segment path (0,0)-(2,0)-
 * (5,0)-(8,0), where segment 1 (index 1, x=0..2, touching the source) and
 * segment 3 (index 3, x=5..8, touching the target) are terminal, and
 * segment 2 (index 2, x=2..5) is the only non-terminal one.
 *
 * Columns 0,1,2,5,6,7,8 are set to width 10 (terminal segments 1 and 3
 * total 30 and 40 respectively); columns 3,4 stay at width 1 (segment 2
 * totals 22, via its shared boundary columns 2 and 5). All three stay
 * under the 60-character label below, so the primary and "any suitable
 * segment" tiers both fail on width alone regardless of clearOfNodes.
 */
function makeAsymmetricWidthGraph(): { graph: AsciiGraph; edge: AsciiEdge } {
  const from = makeNode('A', 0, 0)
  const to = makeNode('B', 8, 0)
  const graph = makeGraph([from, to])

  for (const x of [0, 1, 2, 5, 6, 7, 8]) graph.columnWidth.set(x, 10)
  for (const x of [3, 4]) graph.columnWidth.set(x, 1)

  const edge: AsciiEdge = {
    from,
    to,
    // 60 characters: wider than every segment's combined width above
    // (the widest, segment 3, totals 40).
    text: 'this label is deliberately far too long to ever possibly fit',
    path: [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 5, y: 0 },
      { x: 8, y: 0 },
    ],
    labelLine: [],
    startDir: Down,
    endDir: Down,
    style: 'solid',
    hasArrowStart: false,
    hasArrowEnd: true,
  }

  return { graph, edge }
}

describe('determineLabelLine terminal-segment-exclusion fallback tiers', () => {
  it('falls back to clearSegments when the only non-terminal segment is blocked by an unrelated node', () => {
    const { graph, edge } = makeAsymmetricWidthGraph()

    // Block the middle (non-terminal) segment's sole interior cell with an
    // unrelated node's occupied cell, so clearOfNodes reports it blocked —
    // the only non-terminal segment available is then unusable, leaving
    // clearLaterSegments empty and forcing the fallback to clearSegments
    // (any segment clear of nodes, terminal or not).
    graph.grid.add(gridKey({ x: 3, y: 0 }))
    // A cell wedged between the two edge nodes stands in for that
    // unrelated node's own footprint (not registered as a real AsciiNode —
    // clearOfNodes only consults grid occupancy, not node identity).

    expect(() => determineLabelLine(graph, edge)).not.toThrow()

    // Falls back to a terminal segment (clearSegments), not the blocked
    // middle one — confirms the cascade actually walked past the empty
    // clearLaterSegments tier instead of using the blocked segment anyway.
    const [p1, p2] = edge.labelLine
    expect(p1).toBeDefined()
    expect(p2).toBeDefined()
    const usedMiddleSegment =
      (p1!.x === 2 && p2!.x === 5) || (p1!.x === 5 && p2!.x === 2)
    expect(usedMiddleSegment).toBe(false)
  })

  it('uses the non-terminal segment via clearLaterSegments even though the terminal segments are wider', () => {
    const { graph, edge } = makeAsymmetricWidthGraph()

    // Unlike the previous test, nothing blocks the middle (non-terminal)
    // segment's interior this time, so clearLaterSegments ends up with
    // exactly that one segment. The terminal segments are wider (30/40 vs
    // 22) and would win a width-descending sort if they weren't excluded —
    // this is what actually catches a mutation that drops the terminal
    // exclusion from clearLaterSegments's filter (see this file's header).
    expect(() => determineLabelLine(graph, edge)).not.toThrow()

    const [p1, p2] = edge.labelLine
    const usedMiddleSegment =
      (p1!.x === 2 && p2!.x === 5) || (p1!.x === 5 && p2!.x === 2)
    expect(usedMiddleSegment).toBe(true)
  })
})
