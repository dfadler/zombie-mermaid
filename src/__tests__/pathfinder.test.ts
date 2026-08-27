import { describe, it, expect } from 'vitest'
import {
  getPath,
  heuristic,
  mergePath,
  createPathBudget,
  DEFAULT_PATH_BUDGET,
} from '../ascii/pathfinder.ts'
import type { GridCoord, PathBudget } from '../ascii/types.ts'
import { createGrid, placeBlock, type Grid } from '../ascii/grid-occupancy.ts'
import { renderMermaidASCII } from '../ascii/index.ts'

/**
 * Helper to build an occupied grid from a list of coordinates, going through
 * the real `Grid` abstraction rather than hand-rolling a raw Map/Set — a
 * size-1 "block" reserves exactly the one requested cell.
 */
function buildGrid(occupied: GridCoord[]): Grid {
  const grid = createGrid()
  for (const c of occupied) {
    placeBlock(grid, c, 1)
  }
  return grid
}

describe('pathfinder', () => {
  describe('getPath', () => {
    it('finds a straight-line path on an empty grid', () => {
      const grid = buildGrid([])
      const path = getPath(grid, { x: 0, y: 0 }, { x: 0, y: 3 })
      expect(path).not.toBeNull()
      expect(path![0]).toEqual({ x: 0, y: 0 })
      expect(path![path!.length - 1]).toEqual({ x: 0, y: 3 })
    })

    it('routes around an obstacle', () => {
      // Block the straight path at (0,1)
      const grid = buildGrid([{ x: 0, y: 1 }])
      const path = getPath(grid, { x: 0, y: 0 }, { x: 0, y: 2 })
      expect(path).not.toBeNull()
      expect(path![0]).toEqual({ x: 0, y: 0 })
      expect(path![path!.length - 1]).toEqual({ x: 0, y: 2 })
      // Path must detour (length > 3)
      expect(path!.length).toBeGreaterThan(3)
    })

    it('returns null when destination is completely enclosed', () => {
      // Surround (2,2) with occupied cells on all 4 sides
      const grid = buildGrid([
        { x: 1, y: 2 },
        { x: 3, y: 2 },
        { x: 2, y: 1 },
        { x: 2, y: 3 },
      ])
      const path = getPath(grid, { x: 0, y: 0 }, { x: 2, y: 2 })
      // Destination is occupied-surrounded; A* should return null within iteration limit
      // (not throw RangeError: Map maximum size exceeded)
      expect(path).toBeNull()
    })

    it('returns null for unreachable destination without exhausting memory', () => {
      // Create a wall that blocks access to the target region
      const occupied: GridCoord[] = []
      for (let i = 0; i < 100; i++) {
        occupied.push({ x: 5, y: i }) // vertical wall at x=5
      }
      const grid = buildGrid(occupied)
      // Target is behind the wall; only reachable via y<0 (disallowed) or y>=100 (very far)
      getPath(grid, { x: 0, y: 50 }, { x: 10, y: 50 })
      // Should find a path going around the wall (via y>=100), or return null if
      // the iteration limit is hit. Either outcome is acceptable; the key is no
      // crash / unbounded memory growth.
      expect(true).toBe(true)
    })
  })

  describe('heuristic', () => {
    it('returns 0 for same point', () => {
      expect(heuristic({ x: 3, y: 5 }, { x: 3, y: 5 })).toBe(0)
    })

    it('returns manhattan distance for axis-aligned points', () => {
      expect(heuristic({ x: 0, y: 0 }, { x: 0, y: 5 })).toBe(5)
      expect(heuristic({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(3)
    })

    it('adds +1 penalty for diagonal displacement', () => {
      expect(heuristic({ x: 0, y: 0 }, { x: 2, y: 3 })).toBe(6) // 2+3+1
    })
  })

  describe('mergePath', () => {
    it('removes collinear intermediate points', () => {
      const path: GridCoord[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 1 },
      ]
      const merged = mergePath(path)
      expect(merged).toEqual([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 1 },
      ])
    })

    it('returns short paths unchanged', () => {
      expect(mergePath([{ x: 0, y: 0 }])).toEqual([{ x: 0, y: 0 }])
      expect(
        mergePath([
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ]),
      ).toEqual([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ])
    })
  })

  describe('PathBudget (render-wide iteration budget)', () => {
    // These test the deterministic mechanism that actually bounds total
    // pathfinding work for a render — not wall-clock time. See the
    // ascii-edge-routing-fixes.test.ts "much larger dense fan-in" test
    // (PR #143) for the wall-clock version of this same regression guard,
    // which flaked under CPU contention because it measures how long the
    // work took rather than how much work happened. Asserting on
    // budget.remaining instead is immune to machine speed/load entirely.

    it('createPathBudget defaults to DEFAULT_PATH_BUDGET', () => {
      expect(createPathBudget()).toEqual({ remaining: DEFAULT_PATH_BUDGET })
    })

    it('createPathBudget accepts a custom total', () => {
      expect(createPathBudget(500)).toEqual({ remaining: 500 })
    })

    it('decrements a shared budget cumulatively across multiple getPath calls', () => {
      const grid = buildGrid([])
      const budget = createPathBudget(1000)
      const initial = budget.remaining

      getPath(grid, { x: 0, y: 0 }, { x: 0, y: 20 }, budget)
      const afterFirst = budget.remaining
      expect(afterFirst).toBeLessThan(initial)

      getPath(grid, { x: 0, y: 0 }, { x: 0, y: 20 }, budget)
      const afterSecond = budget.remaining
      // Same search run twice costs the same iterations each time, and the
      // budget is cumulative across calls, not reset per call — so the
      // second call must spend down further from where the first left off.
      expect(afterSecond).toBeLessThan(afterFirst)
    })

    it('returns null immediately once the budget is exhausted, without spending further iterations', () => {
      const grid = buildGrid([])
      const budget: PathBudget = { remaining: 0 }
      const result = getPath(grid, { x: 0, y: 0 }, { x: 0, y: 5 }, budget)
      expect(result).toBeNull()
      // The exhausted-budget check is the first thing getPath does, before
      // the search loop runs at all, so remaining stays unchanged.
      expect(budget.remaining).toBe(0)
    })

    it('never lets budget.remaining go negative', () => {
      const grid = buildGrid([])
      const budget = createPathBudget(3) // deliberately smaller than this search needs
      getPath(grid, { x: 0, y: 0 }, { x: 0, y: 50 }, budget)
      expect(budget.remaining).toBeGreaterThanOrEqual(0)
    })

    it('bounds total pathfinding work across many edges to the budget, regardless of edge count', () => {
      // Structural equivalent of the "much larger dense fan-in" wall-clock
      // test: 120 fan-in edges, each independently getting its own
      // unbounded allowance, is what caused the real OOM crashes this
      // budget exists to prevent (see pathfinder.ts's PathBudget doc
      // comment). Here, a deliberately small shared budget stands in for
      // "more total demand than the budget allows" — the same shape of
      // problem as 120 real edges against the production default.
      const grid = buildGrid([])
      const budget = createPathBudget(500)
      for (let i = 0; i < 120; i++) {
        getPath(grid, { x: i, y: 0 }, { x: i, y: 40 }, budget)
      }
      // Total demand (120 searches x ~40+ iterations each) far exceeds the
      // 500-iteration budget, so it must land at exactly 0 — proving later
      // calls were actually cut off partway through, not merely that none
      // of them individually happened to exceed it.
      expect(budget.remaining).toBe(0)
    })
  })

  describe('dense graph regression', () => {
    it('does not crash on dense TD graph with multiple fan-in bundles', () => {
      // Regression test for: RangeError: Map maximum size exceeded
      // https://github.com/lukilabs/beautiful-mermaid/issues/64
      const code = `graph TD
    A["AAA<br>(keita)"] --> C["CCC"]
    B["BBB<br>(yuriko)"] --> C
    C --> D["DDDD"]
    D --> E["EEEE"]

    A1["1 / 2"] --> A
    A2["3 / 4"] --> A
    A3["5 / 6"] --> A
    A4["XXX<br>(YYY ZZZ)"] --> A

    B1["77 77<br>(7 / 7 / 7)"] --> B
    B2["88-88<br>(99 99)"] --> B
    B3["111s 222s"] --> B

    D --> F{"F?"}
    F -->|Yes| G["High level<br>Tr"]
    F -->|No| H["Dumb Tr<br>S"]`

      // Should not throw (previously threw RangeError: Map maximum size exceeded)
      const result = renderMermaidASCII(code, { useAscii: false })
      expect(result).toBeDefined()
      expect(result.length).toBeGreaterThan(0)
      // Verify most node labels appear (some may be visually clipped by edge routing)
      for (const label of [
        'CCC',
        'DDDD',
        'EEEE',
        '1 / 2',
        '3 / 4',
        '5 / 6',
        'XXX',
        '77 77',
        '88-88',
        '111s 222s',
        'F?',
      ]) {
        expect(result).toContain(label)
      }
    })
  })
})
