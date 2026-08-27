/**
 * Direct coverage for pathfinder.ts's routeEdge (and the tryDirectPath fast
 * path it wraps) — previously untested (PR #178 review). routeEdge is the
 * shared seam edge-routing.ts's determinePath and edge-bundling.ts's
 * routeBundledEdges both route through: try an unobstructed direct L-shaped
 * path first, falling back to A* search, and require a render-wide
 * pathBudget rather than silently degrading when one is absent.
 *
 * The "try both L orientations" behavior below is the fix for the
 * arrival-vs-departure direction bug the review found: `dir` picks a
 * *preferred* corner order, but when that orientation is blocked the other
 * orientation is tried too, so routeEdge produces a correct direct path
 * even when a caller's `dir` reflects an arrival anchor rather than the
 * true departure direction (see edge-bundling.ts's routeBundledEdges).
 */
import { describe, it, expect } from 'vitest'
import { routeEdge, createPathBudget } from '../ascii/pathfinder.ts'
import {
  Up,
  Down,
  Left,
  Right,
  Middle,
  UpperRight,
  requireCardinalDirection,
} from '../ascii/types.ts'
import type { AsciiGraph, AsciiNode, PathBudget } from '../ascii/types.ts'

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

function makeGraph(
  grid: Map<string, AsciiNode>,
  pathBudget: PathBudget | undefined,
): AsciiGraph {
  return {
    nodes: [],
    edges: [],
    canvas: [],
    roleCanvas: [],
    grid,
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
    pathBudget,
  }
}

describe('routeEdge', () => {
  it('takes the horizontal-first direct L when dir is Right', () => {
    const graph = makeGraph(new Map(), createPathBudget())
    const path = routeEdge(
      graph,
      { x: 0, y: 0 },
      { x: 4, y: 4 },
      requireCardinalDirection(Right),
    )
    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
    ])
  })

  it('takes the vertical-first direct L when dir is Down', () => {
    const graph = makeGraph(new Map(), createPathBudget())
    const path = routeEdge(
      graph,
      { x: 0, y: 0 },
      { x: 4, y: 4 },
      requireCardinalDirection(Down),
    )
    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 4 },
      { x: 4, y: 4 },
    ])
  })

  it('falls back to the other L orientation when the preferred one is blocked', () => {
    // dir=Right prefers the {4,0} corner; occupy it so only the {0,4}
    // corner (vertical-first) is clear. This is exactly the scenario the
    // arrival-vs-departure bug hit: a caller passes a `dir` that doesn't
    // match the true departure axis, but the direct path is still found
    // because both orientations are tried.
    const grid = new Map<string, AsciiNode>()
    grid.set('4,0', makeNode('X', 4, 0))
    const graph = makeGraph(grid, createPathBudget())
    const path = routeEdge(
      graph,
      { x: 0, y: 0 },
      { x: 4, y: 4 },
      requireCardinalDirection(Right),
    )
    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 4 },
      { x: 4, y: 4 },
    ])
  })

  it('falls back to A* when both direct L orientations are blocked', () => {
    const grid = new Map<string, AsciiNode>()
    grid.set('4,0', makeNode('X', 4, 0))
    grid.set('0,4', makeNode('Y', 0, 4))
    const graph = makeGraph(grid, createPathBudget())
    const path = routeEdge(
      graph,
      { x: 0, y: 0 },
      { x: 4, y: 4 },
      requireCardinalDirection(Right),
    )
    // Not a 3-point direct L — A* found a route around the two blockers.
    expect(path).not.toBeNull()
    expect(path!.length).toBeGreaterThan(3)
    expect(path![0]).toEqual({ x: 0, y: 0 })
    expect(path![path!.length - 1]).toEqual({ x: 4, y: 4 })
  })

  it('falls back to A* (trivial straight line) when from/to are already axis-aligned', () => {
    const graph = makeGraph(new Map(), createPathBudget())
    const path = routeEdge(
      graph,
      { x: 0, y: 0 },
      { x: 0, y: 6 },
      requireCardinalDirection(Down),
    )
    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 6 },
    ])
  })

  it('returns null when the destination is unreachable through free cells', () => {
    // Occupy all 4 neighbors of the destination — no legal final hop exists
    // from any direction, so neither the direct path nor A* can reach it.
    const grid = new Map<string, AsciiNode>()
    grid.set('9,10', makeNode('a', 9, 10))
    grid.set('11,10', makeNode('b', 11, 10))
    grid.set('10,9', makeNode('c', 10, 9))
    grid.set('10,11', makeNode('d', 10, 11))
    const graph = makeGraph(grid, createPathBudget())
    const path = routeEdge(
      graph,
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      requireCardinalDirection(Right),
    )
    expect(path).toBeNull()
  })

  it('throws when graph.pathBudget is not set, instead of silently searching unbudgeted', () => {
    const graph = makeGraph(new Map(), undefined)
    expect(() =>
      routeEdge(
        graph,
        { x: 0, y: 0 },
        { x: 4, y: 4 },
        requireCardinalDirection(Right),
      ),
    ).toThrow(/pathBudget/)
  })
})

describe('requireCardinalDirection', () => {
  it('passes through each of the 4 cardinal directions', () => {
    for (const d of [Up, Down, Left, Right]) {
      expect(requireCardinalDirection(d)).toBe(d)
    }
  })

  it('throws for a diagonal direction', () => {
    expect(() => requireCardinalDirection(UpperRight)).toThrow(/cardinal/)
  })

  it('throws for Middle', () => {
    expect(() => requireCardinalDirection(Middle)).toThrow(/cardinal/)
  })
})
