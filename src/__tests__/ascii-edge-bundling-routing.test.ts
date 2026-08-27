/**
 * Direct coverage for edge-bundling.ts's routeBundledEdges /
 * calculateJunctionPoint — previously untested (PR #178 review): no test
 * imported either function, so the fan-in/fan-out routing math (junction
 * placement, per-edge pathToJunction, shared trunk path) was only ever
 * exercised indirectly through draw-bundles.ts's rendering tests.
 *
 * Also covers the LR branches directly. analyzeEdgeBundles only ever
 * creates bundles for TD graphs (LR routing merges naturally at corners),
 * so routeBundledEdges' LR ternaries are unreachable through any real
 * Mermaid diagram today — but the function itself handles both directions,
 * and after the PR #178 fix (routeEdge/tryDirectPath try both L
 * orientations instead of trusting a possibly-wrong `dir`), the LR path is
 * exercised here directly and pinned, rather than left as untested dead
 * code with the same direction-confusion risk the TD side had.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../parser.ts'
import { convertToAsciiGraph } from '../ascii/converter.ts'
import { createMapping } from '../ascii/grid.ts'
import {
  calculateJunctionPoint,
  routeBundledEdges,
} from '../ascii/edge-bundling.ts'
import { Middle } from '../ascii/types.ts'
import type { AsciiConfig, AsciiGraph, EdgeBundle } from '../ascii/types.ts'

function buildGraph(src: string, graphDirection: 'TD' | 'LR'): AsciiGraph {
  const config: AsciiConfig = {
    useAscii: false,
    paddingX: 5,
    paddingY: 5,
    boxBorderPadding: 1,
    graphDirection,
  }
  const graph = convertToAsciiGraph(parseMermaid(src), config)
  createMapping(graph)
  return graph
}

const FAN_OUT_TD = `flowchart TD
  C[Source] --> A[One]
  C --> B[Two]`

const FAN_IN_TD = `flowchart TD
  A[One] --> C[Target]
  B[Two] --> C`

describe('routeBundledEdges (TD, via the real layout pipeline)', () => {
  it('pins the fan-out junction and per-target paths', () => {
    const graph = buildGraph(FAN_OUT_TD, 'TD')
    expect(graph.bundles).toHaveLength(1)
    const bundle = graph.bundles[0]!
    expect(bundle.type).toBe('fan-out')

    const C = graph.nodes.find((n) => n.name === 'C')!
    expect(bundle.junctionPoint).toEqual({
      x: C.gridCoord!.x + 1,
      y: C.gridCoord!.y + 3,
    })

    // Every edge in the bundle shares the same trunk directions.
    for (const edge of bundle.edges) {
      expect(edge.startDir).toEqual({ x: 1, y: 2 }) // Down
      expect(edge.endDir).toEqual({ x: 1, y: 0 }) // Up
      expect(edge.pathToJunction).toBeDefined()
      expect(edge.pathToJunction!.at(0)).toEqual(bundle.junctionPoint)
    }
  })

  it('pins the fan-in junction and per-source paths', () => {
    const graph = buildGraph(FAN_IN_TD, 'TD')
    expect(graph.bundles).toHaveLength(1)
    const bundle = graph.bundles[0]!
    expect(bundle.type).toBe('fan-in')

    const C = graph.nodes.find((n) => n.name === 'C')!
    expect(bundle.junctionPoint).toEqual({
      x: C.gridCoord!.x + 1,
      y: C.gridCoord!.y - 1,
    })
    expect(bundle.sharedPath.at(-1)).toEqual({
      x: C.gridCoord!.x + 1,
      y: C.gridCoord!.y,
    })

    for (const edge of bundle.edges) {
      expect(edge.startDir).toEqual({ x: 1, y: 2 }) // Down
      expect(edge.endDir).toEqual({ x: 1, y: 0 }) // Up
      expect(edge.pathToJunction!.at(-1)).toEqual(bundle.junctionPoint)
    }
  })

  it('routes a 3-way fan-out with an unobstructed direct path to each target (no zigzag)', () => {
    // Regression check for the PR #178 arrival-vs-departure direction bug:
    // before the fix, the junction->target segment's fast path was dead
    // for every fan-out edge except the (degenerate, always-aligned) first
    // one, so off-center targets could get an A*-search path instead of
    // the direct 2-segment L. Each pathToJunction here must be exactly 2
    // segments (junction, corner, target) or, when already axis-aligned, 1.
    const graph = buildGraph(
      `flowchart TD
        C[Source] --> A[One]
        C --> B[A much longer target]
        C --> D[Three]`,
      'TD',
    )
    const bundle = graph.bundles[0]!
    for (const edge of bundle.edges) {
      const path = edge.pathToJunction!
      // A direct L is at most 3 points (or 2 if already axis-aligned) —
      // never a longer A*-search detour.
      expect(path.length).toBeLessThanOrEqual(3)
    }
  })
})

describe('routeBundledEdges (LR, called directly)', () => {
  // analyzeEdgeBundles never creates a bundle for an LR graph, so these
  // build one by hand from a real LR-laid-out graph's nodes/edges and call
  // routeBundledEdges directly — exercising the function's LR branches with
  // pinned coordinates instead of leaving them untested.
  function makeBundle(
    type: 'fan-in' | 'fan-out',
    graph: AsciiGraph,
    sharedName: string,
  ): EdgeBundle {
    const shared = graph.nodes.find((n) => n.name === sharedName)!
    const edges = graph.edges.filter((e) =>
      type === 'fan-out' ? e.from === shared : e.to === shared,
    )
    return {
      type,
      edges,
      sharedNode: shared,
      otherNodes: edges.map((e) => (type === 'fan-out' ? e.to : e.from)),
      junctionPoint: null,
      sharedPath: [],
      junctionDir: Middle,
      sharedNodeDir: Middle,
    }
  }

  it('pins fan-out junction/target coordinates for an LR graph', () => {
    const graph = buildGraph(
      `flowchart LR
        C[Source] --> A[One]
        C --> B[Two]`,
      'LR',
    )
    const bundle = makeBundle('fan-out', graph, 'C')
    const C = graph.nodes.find((n) => n.name === 'C')!

    const junction = calculateJunctionPoint(graph, bundle)
    expect(junction).toEqual({ x: C.gridCoord!.x + 3, y: C.gridCoord!.y + 1 })

    routeBundledEdges(graph, bundle)
    expect(bundle.junctionPoint).toEqual(junction)
    expect(bundle.sharedPath.at(-1)).toEqual(junction)

    for (const edge of bundle.edges) {
      const target = edge.to
      expect(edge.startDir).toEqual({ x: 2, y: 1 }) // Right
      expect(edge.endDir).toEqual({ x: 0, y: 1 }) // Left
      const path = edge.pathToJunction!
      expect(path.at(0)).toEqual(junction)
      expect(path.at(-1)).toEqual({
        x: target.gridCoord!.x,
        y: target.gridCoord!.y + 1,
      })
      // Direct L (or already-aligned straight line) — never an A* detour.
      expect(path.length).toBeLessThanOrEqual(3)
    }
  })

  it('pins fan-in junction/source coordinates for an LR graph', () => {
    const graph = buildGraph(
      `flowchart LR
        A[One] --> C[Target]
        B[Two] --> C`,
      'LR',
    )
    const bundle = makeBundle('fan-in', graph, 'C')
    const C = graph.nodes.find((n) => n.name === 'C')!

    const junction = calculateJunctionPoint(graph, bundle)
    expect(junction).toEqual({ x: C.gridCoord!.x - 1, y: C.gridCoord!.y + 1 })

    routeBundledEdges(graph, bundle)
    expect(bundle.junctionPoint).toEqual(junction)
    expect(bundle.sharedPath.at(0)).toEqual(junction)
    expect(bundle.sharedPath.at(-1)).toEqual({
      x: C.gridCoord!.x,
      y: C.gridCoord!.y + 1,
    })

    for (const edge of bundle.edges) {
      const source = edge.from
      expect(edge.startDir).toEqual({ x: 2, y: 1 }) // Right
      expect(edge.endDir).toEqual({ x: 0, y: 1 }) // Left
      const path = edge.pathToJunction!
      expect(path.at(-1)).toEqual(junction)
      expect(path.at(0)).toEqual({
        x: source.gridCoord!.x + 2,
        y: source.gridCoord!.y + 1,
      })
      expect(path.length).toBeLessThanOrEqual(3)
    }
  })
})
