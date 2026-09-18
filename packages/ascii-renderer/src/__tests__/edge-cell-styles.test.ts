import { describe, it, expect } from 'vitest'
import {
  createEdgeCellStyles,
  findStyleConflict,
  claimPathCells,
  createEdgeCellOwners,
  findUnrelatedOverlap,
  claimPathOwners,
} from '../edge-cell-styles.ts'
import {
  createGrid,
  placeBlock,
} from '../grid-occupancy.ts'
import type {
  AsciiEdge,
  AsciiNode,
} from '../types.ts'
import { Down } from '../types.ts'

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
    expect(findStyleConflict(grid, cellStyles, unrelated, 'dotted')).toBeNull()
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

function makeNode(name: string): AsciiNode {
  return {
    name,
    displayLabel: name,
    shape: 'rectangle',
    index: 0,
    gridCoord: null,
    drawingCoord: null,
    drawing: null,
    drawn: false,
    styleClassName: '',
    styleClass: { name: '', styles: {} },
  }
}

function makeEdge(from: AsciiNode, to: AsciiNode): AsciiEdge {
  return {
    from,
    to,
    text: '',
    path: [],
    labelLine: [],
    startDir: Down,
    endDir: Down,
    style: 'solid',
    hasArrowStart: false,
    hasArrowEnd: true,
  }
}

describe('edge-cell-styles — chain overlap (multi-owner cells)', () => {
  /**
   * Regression for a CodeRabbit finding on PR #1093 (the #1067 fix):
   * `claimPathOwners` originally stored only the *first* edge to claim a
   * cell (`if (!owners.has(key)) owners.set(key, edge)`). When an edge
   * unrelated to any chain claims a shared cell before the real chain
   * partner does (an ordering `graph.edges` doesn't control), the chain
   * partner's own claim was silently dropped — so `findUnrelatedOverlap`
   * only ever saw the unrelated edge's claim, never found a chain pair, and
   * missed the real overlap entirely. Cells must track every edge that
   * claims them, not just the first.
   */
  it('detects a chain-pair overlap even when an unrelated edge claimed the corridor first', () => {
    const grid = createGrid()
    const owners = createEdgeCellOwners()

    const a = makeNode('A')
    const b = makeNode('B')
    const c = makeNode('C')
    const x = makeNode('X')
    const y = makeNode('Y')

    const edgeAB = makeEdge(a, b)
    const edgeBC = makeEdge(b, c)
    const edgeXY = makeEdge(x, y) // unrelated to the A->B->C chain

    const corridor = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ]

    // The unrelated edge claims the corridor first.
    claimPathOwners(grid, owners, corridor, edgeXY)
    // The true chain partner (A->B) also routes through it.
    claimPathOwners(grid, owners, corridor, edgeAB)

    // B->C, checked against the same corridor, must still find its A->B
    // chain partner's overlap — not be hidden behind X->Y's earlier claim.
    const conflict = findUnrelatedOverlap(grid, owners, corridor, edgeBC)
    expect(conflict).toEqual({ x: 0, y: 0 })
  })

  it('still finds nothing when only an unrelated edge claimed the corridor', () => {
    const grid = createGrid()
    const owners = createEdgeCellOwners()

    const b = makeNode('B')
    const c = makeNode('C')
    const x = makeNode('X')
    const y = makeNode('Y')

    const edgeBC = makeEdge(b, c)
    const edgeXY = makeEdge(x, y)

    const corridor = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ]

    claimPathOwners(grid, owners, corridor, edgeXY)

    expect(findUnrelatedOverlap(grid, owners, corridor, edgeBC)).toBeNull()
  })
})
