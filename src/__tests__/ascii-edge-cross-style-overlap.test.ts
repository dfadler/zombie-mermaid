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
import {
  isOccupied,
  pathCells,
  createGrid,
  cloneGrid,
  placeBlock,
} from '../ascii/grid-occupancy.ts'
import {
  createEdgeCellStyles,
  findStyleConflict,
  claimPathCells,
} from '../ascii/edge-cell-styles.ts'
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

  /**
   * Regression for a CodeRabbit finding on this PR: `rerouteAroundStyleConflicts`
   * (grid.ts) temporarily adds a conflicting cell to `graph.grid` so A*
   * avoids it on retry, then removes the reservation once the edge is
   * done. An earlier version passed that *same live, mutating* grid to
   * `findStyleConflict`'s "is this cell node-owned, and therefore not a
   * real conflict" check — so on a second re-route attempt, the cell
   * blocked on attempt 1 looked node-occupied and got silently skipped. If
   * A*'s direct fallback (which ignores occupancy entirely) still crossed
   * that exact cell, the loop wrongly concluded "no conflict" and stopped,
   * leaving the two differently-styled edges still overlapping there.
   *
   * The fix: pass a `nodeOnlyGrid` snapshot — cloned via `cloneGrid` right
   * after node placement, before any edge is routed — to the conflict
   * check instead. This test reproduces the exact mechanism directly:
   * checking against the live (temp-mutated) grid misses the conflict;
   * checking against a frozen snapshot correctly still reports it.
   */
  it('a temporary reroute reservation on the live grid must not hide a conflict from the frozen node-only snapshot', () => {
    const grid = createGrid()
    placeBlock(grid, { x: 4, y: 8 }) // node D's reserved 3x3 block
    const nodeOnlyGrid = cloneGrid(grid) // taken before any temporary reservation

    const cellStyles = createEdgeCellStyles()
    const solidPath = [
      { x: 2, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 8 },
    ]
    claimPathCells(nodeOnlyGrid, cellStyles, solidPath, 'solid')

    const dottedPathThatStillCrossesTheConflict = [
      { x: 5, y: 1 },
      { x: 5, y: 8 },
    ]

    // Simulate what `rerouteAroundStyleConflicts`'s retry loop does when
    // A*'s direct fallback keeps returning the *same* unchanged path each
    // time (occupancy-blind, by definition): each iteration finds the
    // next not-yet-blocked conflicting cell and adds it to the live grid.
    // With three open-space conflict cells in the path — (5,5), (5,6),
    // (5,7) — three iterations exhaust every real conflict this way
    // without the edge's route ever actually changing.
    for (let i = 0; i < 3; i++) {
      const conflict = findStyleConflict(
        grid,
        cellStyles,
        dottedPathThatStillCrossesTheConflict,
        'dotted',
      )
      expect(conflict).not.toBeNull()
      grid.add(`${conflict!.x},${conflict!.y}`)
    }

    // The bug: after those three iterations, every real conflict cell now
    // looks node-occupied on the live grid — checking against it reports
    // "no conflict" even though the edge's path (unchanged this whole
    // time) still overlaps the solid path in open space.
    const missedByLiveGrid = findStyleConflict(
      grid,
      cellStyles,
      dottedPathThatStillCrossesTheConflict,
      'dotted',
    )
    expect(missedByLiveGrid).toBeNull()

    // The fix: checking against the untouched snapshot is unaffected by
    // any of those temporary reservations, so the real conflict is still
    // caught (reported at the first crossing cell in path order).
    const caughtByFrozenSnapshot = findStyleConflict(
      nodeOnlyGrid,
      cellStyles,
      dottedPathThatStillCrossesTheConflict,
      'dotted',
    )
    expect(caughtByFrozenSnapshot).toEqual({ x: 5, y: 5 })
  })
})
