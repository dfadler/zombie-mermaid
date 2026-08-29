/**
 * Regression tests for a real-world bug: `graph.grid` (grid-occupancy.ts)
 * only tracks *node* occupancy, so two edges with neither a shared source
 * nor a shared target — the only cases `analyzeEdgeBundles` groups, and the
 * only relationship A*'s own occupancy check knows about — could
 * independently route through the same empty cell. When the two edges have
 * different line styles (e.g. a solid branch and a dotted retry/back-edge,
 * a very ordinary shape for any diagram with a retry loop), one silently
 * overwrote the other's glyph in the final canvas: the rendered line looked
 * like a single corrupted half-solid, half-dotted run, with no visual
 * indication that two distinct connections were even there.
 *
 * Repro: a decision node with a "No" branch to a retry node, which then
 * dotted-links back to the start — reported against the CI/CD Pipeline
 * sample on the project's own samples page (a subgraph made it more likely,
 * by leaving less free routing space, but the underlying bug has nothing to
 * do with subgraphs — this repro has none).
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../parser.ts'
import { convertToAsciiGraph } from '../ascii/converter.ts'
import { createMapping } from '../ascii/grid.ts'
import { isOccupied, pathCells } from '../ascii/grid-occupancy.ts'
import { renderMermaidASCII } from '../ascii/index.ts'
import type { AsciiConfig, AsciiEdge, AsciiGraph } from '../ascii/types.ts'

const RETRY_LOOP_SOURCE = `graph TD
    A[Push Code] --> B{Tests Pass?}
    B -->|Yes| C[Build Image]
    B -->|No| D[Fix & Retry]
    D -.-> A`

function findEdge(
  edges: AsciiEdge[],
  fromName: string,
  toName: string,
): AsciiEdge {
  const edge = edges.find(
    (e) => e.from.name === fromName && e.to.name === toName,
  )
  if (!edge) {
    throw new Error(`Expected an edge ${fromName} -> ${toName}`)
  }
  return edge
}

/**
 * Cells owned by a node's own reserved block are excluded: both edges
 * necessarily touch D's border where they connect to it (one incoming, one
 * outgoing), and that shared port cell is drawn by D's own box-drawing
 * code, not either edge's line style — see edge-cell-styles.ts's module
 * doc. Only *open, non-node* cells are where a real cross-style collision
 * would silently overwrite a glyph.
 */
function openPathCells(graph: AsciiGraph, path: AsciiEdge['path']): string[] {
  return pathCells(path)
    .filter((c) => !isOccupied(graph.grid, c))
    .map((c) => `${c.x},${c.y}`)
}

describe('cross-style edge overlap', () => {
  it('routes a solid branch edge and an unrelated dotted back-edge through disjoint open-space cells', () => {
    const parsed = parseMermaid(RETRY_LOOP_SOURCE)
    const config: AsciiConfig = {
      useAscii: false,
      paddingX: 5,
      paddingY: 5,
      boxBorderPadding: 1,
      graphDirection: 'TD',
    }
    const graph = convertToAsciiGraph(parsed, config)
    createMapping(graph)

    const noBranch = findEdge(graph.edges, 'B', 'D')
    const backEdge = findEdge(graph.edges, 'D', 'A')

    expect(noBranch.style).toBe('solid')
    expect(backEdge.style).toBe('dotted')

    const noBranchCells = new Set(openPathCells(graph, noBranch.path))
    const backEdgeCells = openPathCells(graph, backEdge.path)

    // Neither edge shares a source or target with the other (B->D vs
    // D->A), so the *only* thing that can legitimately keep them apart in
    // open routing space is this disjointness check — same-style edges are
    // allowed (and often expected) to share cells, but these two must not.
    const overlap = backEdgeCells.filter((key) => noBranchCells.has(key))
    expect(overlap).toEqual([])
  })

  it('renders the retry-loop repro without throwing', () => {
    // The original report was against a subgraph-wrapped version of this
    // same shape; asserting on the plain render (not just internal path
    // data, above) guards the full pipeline end to end.
    const out = renderMermaidASCII(RETRY_LOOP_SOURCE)
    for (const label of ['Push Code', 'Tests Pass?', 'Build Image', 'Fix']) {
      expect(out).toContain(label)
    }
  })

  /**
   * Regression for the crash discovered while fixing the overlap above: an
   * early version reserved edge-path cells with a naive
   * "x += sign(dx); y += sign(dy)" walk, which only reaches a segment's
   * endpoint when |dx| === |dy|. `determinePath`'s Case-4 direct fallback
   * can produce a segment with any dx/dy ratio, and this plain 4-edge
   * fan-out is enough to trigger it — the walk never terminated and ran
   * until the `Set` backing the occupancy grid threw "maximum size
   * exceeded". See grid-occupancy.test.ts's `pathCells` tests for the
   * unit-level version of this.
   */
  it('does not hang or crash on a plain fan-out that exercises the direct-fallback path', () => {
    const start = Date.now()
    const out = renderMermaidASCII(
      'flowchart LR\n  A --> B\n  A --> C\n  A --> D\n  A --> E',
      { colorMode: 'none' },
    )
    expect(Date.now() - start).toBeLessThan(5000)
    for (const label of ['A', 'B', 'C', 'D', 'E']) {
      expect(out).toContain(label)
    }
  })
})
