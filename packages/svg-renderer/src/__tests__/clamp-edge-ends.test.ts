import { describe, it, expect } from 'vitest'
import type {
  PositionedEdge,
  PositionedGraph,
  PositionedNode,
} from '@zombie-mermaid/core'
import { clampEdgeEnds } from '../layout-engine/clamp-edge-ends.ts'

const node = (id: string, shape: string, x: number, y: number) =>
  ({ id, shape, x, y, width: 100, height: 40 }) as unknown as PositionedNode

const edge = (source: string, target: string, pts: Array<[number, number]>) =>
  ({
    source,
    target,
    points: pts.map(([x, y]) => ({ x, y })),
  }) as unknown as PositionedEdge

const graph = (nodes: PositionedNode[], edges: PositionedEdge[]) =>
  ({ nodes, edges, groups: [] }) as unknown as PositionedGraph

const pts = (g: PositionedGraph, i = 0) =>
  g.edges[i]!.points.map((p) => [p.x, p.y])

describe('clampEdgeEnds', () => {
  const a = node('a', 'rectangle', 0, 0)
  const b = node('b', 'rectangle', 0, 200)

  it('pulls an end past the box corner back, with the bend beside it', () => {
    const g = graph(
      [a, b],
      [
        edge('a', 'b', [
          [130, 40],
          [130, 120],
          [60, 120],
          [60, 200],
        ]),
      ],
    )
    expect(pts(clampEdgeEnds(g))).toEqual([
      [100, 40],
      [100, 120],
      [60, 120],
      [60, 200],
    ])
  })

  it('leaves an end already on the face alone', () => {
    const g = graph(
      [a, b],
      [
        edge('a', 'b', [
          [50, 40],
          [50, 200],
        ]),
      ],
    )
    expect(pts(clampEdgeEnds(g))).toEqual([
      [50, 40],
      [50, 200],
    ])
  })

  it('does not change its input', () => {
    const g = graph(
      [a, b],
      [
        edge('a', 'b', [
          [130, 40],
          [130, 120],
          [60, 120],
          [60, 200],
        ]),
        edge('a', 'b', [
          [130, 40],
          [130, 200],
        ]),
      ],
    )
    const before = structuredClone(g)
    clampEdgeEnds(g)
    expect(g).toEqual(before)
  })

  it('leaves the end on a diamond where it is', () => {
    const d = node('d', 'diamond', 0, 200)
    const g = graph(
      [a, d],
      [
        edge('a', 'd', [
          [130, 40],
          [130, 120],
          [130, 160],
          [130, 200],
        ]),
      ],
    )
    expect(pts(clampEdgeEnds(g))[3]).toEqual([130, 200])
  })

  it('jogs a two-point edge whose flat end overhangs, keeping the curved end', () => {
    const d = node('d', 'diamond', 0, 200)
    // Square down from the rectangle's overhanging end to the diamond's outline.
    const g = graph(
      [a, d],
      [
        edge('a', 'd', [
          [130, 40],
          [130, 210],
        ]),
      ],
    )
    expect(pts(clampEdgeEnds(g))).toEqual([
      [100, 40],
      [100, 125],
      [130, 125],
      [130, 210],
    ])
    // …and the same for a horizontal edge whose flat end is the target.
    const r = node('r', 'rectangle', 200, 0)
    const h = graph(
      [d, r],
      [
        edge('d', 'r', [
          [100, 70],
          [200, 70],
        ]),
      ],
    )
    expect(pts(clampEdgeEnds(h))).toEqual([
      [100, 70],
      [150, 70],
      [150, 40],
      [200, 40],
    ])
  })

  it('skips an edge between two curved shapes and a slanted two-point edge', () => {
    const d1 = node('d1', 'diamond', 0, 0)
    const d2 = node('d2', 'circle', 0, 200)
    const g = graph(
      [d1, d2, a, b],
      [
        edge('d1', 'd2', [
          [130, 40],
          [130, 210],
        ]),
        edge('a', 'b', [
          [130, 40],
          [30, 200],
        ]),
      ],
    )
    const out = clampEdgeEnds(g)
    expect(pts(out, 0)).toEqual([
      [130, 40],
      [130, 210],
    ])
    expect(pts(out, 1)).toEqual([
      [130, 40],
      [30, 200],
    ])
  })

  it('ignores an edge with a missing node', () => {
    const g = graph(
      [a],
      [
        edge('a', 'gone', [
          [130, 40],
          [130, 200],
        ]),
      ],
    )
    expect(pts(clampEdgeEnds(g))).toEqual([
      [130, 40],
      [130, 200],
    ])
  })
})
