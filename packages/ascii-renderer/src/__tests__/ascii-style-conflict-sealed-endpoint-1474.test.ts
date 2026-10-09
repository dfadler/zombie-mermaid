/**
 * #1474: getPath must give up at once on a sealed target (a style-conflict
 * reroute can block its only way in) instead of flooding the grid up to
 * MAX_ITERATIONS.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { convertToAsciiGraph } from '../converter.ts'
import { createMapping } from '../grid.ts'
import { createPathBudget, getPath } from '../pathfinder.ts'
import { createGrid, placeBlock } from '../grid-occupancy.ts'

const CI_CD = `graph TD
  subgraph ci [CI Pipeline]
    A[Push Code] --> B{Tests Pass?}
    B -->|Yes| C[Build Image]
    B -->|No| D[Fix & Retry]
    D -.-> A
  end
  C --> E([Deploy Staging])
  E --> F{QA Approved?}
  F -->|Yes| G((Production))
  F -->|No| D`

describe('#1474 sealed endpoints', () => {
  it('getPath returns null without searching when the target is sealed', () => {
    const grid = createGrid()
    for (const c of [
      { x: 4, y: 5 },
      { x: 6, y: 5 },
      { x: 5, y: 4 },
      { x: 5, y: 6 },
    ]) {
      placeBlock(grid, c, 1)
    }
    const budget = createPathBudget(1000)
    expect(getPath(grid, { x: 0, y: 0 }, { x: 5, y: 5 }, budget)).toBeNull()
    expect(budget.remaining).toBe(1000)
  })

  it('style-conflict rerouting spends almost no A* budget on CI/CD', () => {
    const graph = convertToAsciiGraph(parseMermaid(CI_CD), {
      useAscii: false,
      paddingX: 5,
      paddingY: 5,
      boxBorderPadding: 1,
      graphDirection: 'TD',
    })
    createMapping(graph)
    const used = createPathBudget().remaining - graph.pathBudget!.remaining
    expect(used).toBeLessThan(20_000)
  })
})
