import { describe, it, expect } from 'vitest'
import {
  createEdgeCellStyles,
  findStyleConflict,
  claimPathCells,
} from '../ascii/edge-cell-styles.ts'
import { createGrid, placeBlock } from '../ascii/grid-occupancy.ts'

describe('edge-cell-styles', () => {
  it('reports no conflict against an empty map', () => {
    const grid = createGrid()
    const cellStyles = createEdgeCellStyles()
    const path = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ]
    expect(findStyleConflict(grid, cellStyles, path, 'solid')).toBeNull()
  })

  it('does not flag a second same-style edge through claimed cells', () => {
    const grid = createGrid()
    const cellStyles = createEdgeCellStyles()
    const path = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ]
    claimPathCells(grid, cellStyles, path, 'solid')
    // A second solid edge reusing the same cells is exactly the "sibling
    // edges share a trunk" / "LR routing merges naturally at corners"
    // behavior other tests rely on — must stay unflagged.
    expect(findStyleConflict(grid, cellStyles, path, 'solid')).toBeNull()
  })

  it('flags a different-style edge crossing already-claimed cells', () => {
    const grid = createGrid()
    const cellStyles = createEdgeCellStyles()
    const path = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ]
    claimPathCells(grid, cellStyles, path, 'solid')
    expect(findStyleConflict(grid, cellStyles, path, 'dotted')).toEqual({
      x: 0,
      y: 0,
    })
  })

  it('reports the first conflicting cell in path order', () => {
    const grid = createGrid()
    const cellStyles = createEdgeCellStyles()
    claimPathCells(
      grid,
      cellStyles,
      [
        { x: 5, y: 0 },
        { x: 8, y: 0 },
      ],
      'thick',
    )
    const crossing = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]
    expect(findStyleConflict(grid, cellStyles, crossing, 'solid')).toEqual({
      x: 5,
      y: 0,
    })
  })

  it('first claim wins — claiming a cell twice with different styles keeps the original', () => {
    const grid = createGrid()
    const cellStyles = createEdgeCellStyles()
    const cell = [{ x: 1, y: 1 }]
    claimPathCells(grid, cellStyles, cell, 'solid')
    claimPathCells(grid, cellStyles, cell, 'dotted')
    // Still solid from the first claim, so a *third* dotted edge is still
    // reported as a conflict rather than silently "winning" the cell.
    expect(findStyleConflict(grid, cellStyles, cell, 'dotted')).toEqual({
      x: 1,
      y: 1,
    })
  })

  it('does not flag cells the path never touches', () => {
    const grid = createGrid()
    const cellStyles = createEdgeCellStyles()
    claimPathCells(
      grid,
      cellStyles,
      [
        { x: 0, y: 0 },
        { x: 0, y: 5 },
      ],
      'solid',
    )
    const unrelated = [
      { x: 10, y: 10 },
      { x: 12, y: 10 },
    ]
    expect(
      findStyleConflict(grid, cellStyles, unrelated, 'dotted'),
    ).toBeNull()
  })

  /**
   * Regression: an edge's path always includes its own source/target
   * node's border cell — that's how it connects to the box at all — so
   * two edges sharing a node (one incoming, one outgoing, as in a retry
   * loop's `B -->|No| D; D -.-> A`) legitimately share that exact port
   * cell. An earlier version tracked *every* path cell including
   * node-owned ones, which flagged this as a conflict — and since an edge
   * always returns to its own node's fixed attachment point regardless of
   * grid occupancy, "blocking" a node cell and re-routing found the
   * identical cell again every time, so the fix never actually converged.
   */
  it('does not flag a shared node-border cell as a conflict', () => {
    const grid = createGrid()
    placeBlock(grid, { x: 4, y: 8 }) // node D's reserved 3x3 block
    const cellStyles = createEdgeCellStyles()

    // Incoming solid edge terminating at D's top-center port, (5, 8).
    claimPathCells(
      grid,
      cellStyles,
      [
        { x: 2, y: 5 },
        { x: 5, y: 5 },
        { x: 5, y: 8 },
      ],
      'solid',
    )

    // Outgoing dotted edge leaving from D's right-side port, (6, 9) —
    // inside the same reserved block, so still node-owned — then diverging
    // into its own open column (7) rather than reusing (5, *).
    const conflict = findStyleConflict(
      grid,
      cellStyles,
      [
        { x: 6, y: 9 },
        { x: 7, y: 9 },
        { x: 7, y: 1 },
      ],
      'dotted',
    )
    expect(conflict).toBeNull()
  })

  it('still flags a genuine open-space conflict alongside a shared node border', () => {
    const grid = createGrid()
    placeBlock(grid, { x: 4, y: 8 }) // node D's reserved 3x3 block
    const cellStyles = createEdgeCellStyles()

    claimPathCells(
      grid,
      cellStyles,
      [
        { x: 2, y: 5 },
        { x: 5, y: 5 },
        { x: 5, y: 8 },
      ],
      'solid',
    )

    // A different-style edge that reaches D via the *same open-space*
    // column (5, 5)-(5, 8), not just the shared port cell, is still a
    // real conflict — reported at the first open cell it crosses.
    const conflict = findStyleConflict(
      grid,
      cellStyles,
      [
        { x: 5, y: 1 },
        { x: 5, y: 8 },
      ],
      'dotted',
    )
    expect(conflict).toEqual({ x: 5, y: 5 })
  })
})
