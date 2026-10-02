/**
 * #1239: ELK aims an incoming edge at an off-centre port on a diamond's
 * bounding box, and shape clipping then drops it onto the diamond's slope.
 * mermaid.js aims every edge at the node's centre, so an edge that arrives
 * straight on lands on the vertex. The edge's last bend and final run are
 * moved onto the centre line.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../index.ts'
import { layoutGraphSync } from '@zombie-mermaid/svg-renderer'
import { snapEdgesToDiamondVertices } from '../../packages/svg-renderer/src/layout-engine/diamond-vertex-snap.ts'
import type { PositionedEdge, PositionedNode } from '@zombie-mermaid/core'

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

function node(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  shape = 'rectangle',
): PositionedNode {
  return { id, x, y, width: w, height: h, shape } as PositionedNode
}

function edge(
  source: string,
  target: string,
  points: Array<[number, number]>,
): PositionedEdge {
  return {
    source,
    target,
    style: 'solid',
    hasArrowStart: false,
    hasArrowEnd: true,
    points: points.map(([x, y]) => ({ x, y })),
  } as PositionedEdge
}

/** TD scene: diamond D at x 200..360, y 300..460, so its centre line is x=280. */
const D = node('D', 200, 300, 160, 160, 'diamond')
const S = node('S', 100, 100, 100, 40)

describe('snapEdgesToDiamondVertices', () => {
  it('moves the bend and the final run onto the centre line (TD)', () => {
    const e = edge('S', 'D', [
      [150, 140],
      [150, 200],
      [210, 200],
      [210, 300],
    ])
    snapEdgesToDiamondVertices([e], [S, D])
    expect(e.points).toEqual([
      { x: 150, y: 140 },
      { x: 150, y: 200 },
      { x: 280, y: 200 },
      { x: 280, y: 300 },
    ])
  })

  it('moves a horizontal final run onto the centre line (LR)', () => {
    const d = node('D', 300, 200, 160, 160, 'diamond')
    const s = node('S', 100, 100, 40, 40)
    const e = edge('S', 'D', [
      [140, 120],
      [200, 120],
      [200, 250],
      [300, 250],
    ])
    snapEdgesToDiamondVertices([e], [s, d])
    expect(e.points.slice(-2)).toEqual([
      { x: 200, y: 280 },
      { x: 300, y: 280 },
    ])
  })

  it('works from the bottom and from the other side', () => {
    // Arriving from below, to the left of the centre line.
    const s = node('S', 100, 600, 100, 40)
    const e = edge('S', 'D', [
      [150, 600],
      [150, 540],
      [330, 540],
      [330, 460],
    ])
    snapEdgesToDiamondVertices([e], [s, D])
    expect(e.points.slice(-2)).toEqual([
      { x: 280, y: 540 },
      { x: 280, y: 460 },
    ])
  })

  it('leaves an edge already on the centre line', () => {
    const e = edge('S', 'D', [
      [150, 140],
      [150, 200],
      [280, 200],
      [280, 300],
    ])
    const before = structuredClone(e.points)
    snapEdgesToDiamondVertices([e], [S, D])
    expect(e.points).toEqual(before)
  })

  it('leaves a straight run, which has no jog to shorten', () => {
    const e = edge('S', 'D', [
      [210, 140],
      [210, 300],
    ])
    const before = structuredClone(e.points)
    snapEdgesToDiamondVertices([e], [S, D])
    expect(e.points).toEqual(before)
  })

  it('leaves a run into an off-centre face that has no perpendicular jog', () => {
    const e = edge('S', 'D', [
      [210, 140],
      [210, 200],
      [210, 300],
    ])
    const before = structuredClone(e.points)
    snapEdgesToDiamondVertices([e], [S, D])
    expect(e.points).toEqual(before)
  })

  it('leaves an edge when the final run would be too short for the arrowhead', () => {
    const e = edge('S', 'D', [
      [150, 140],
      [150, 295],
      [210, 295],
      [210, 300],
    ])
    const before = structuredClone(e.points)
    snapEdgesToDiamondVertices([e], [S, D])
    expect(e.points).toEqual(before)
  })

  it('keeps ELK spread when several edges share the face', () => {
    const e1 = edge('S', 'D', [
      [150, 140],
      [150, 200],
      [240, 200],
      [240, 300],
    ])
    const e2 = edge('S', 'D', [
      [170, 140],
      [170, 220],
      [320, 220],
      [320, 300],
    ])
    const before = structuredClone([e1.points, e2.points])
    snapEdgesToDiamondVertices([e1, e2], [S, D])
    expect([e1.points, e2.points]).toEqual(before)
  })

  it('keeps ELK spread when an edge leaves the same face', () => {
    const t = node('T', 100, 100, 100, 40)
    const arriving = edge('S', 'D', [
      [150, 140],
      [150, 200],
      [240, 200],
      [240, 300],
    ])
    const leaving = edge('D', 'T', [
      [320, 300],
      [320, 250],
      [150, 250],
      [150, 140],
    ])
    const before = structuredClone(arriving.points)
    snapEdgesToDiamondVertices([arriving, leaving], [S, D, t])
    expect(arriving.points).toEqual(before)
  })

  it('leaves an edge when another node is in the way of the move', () => {
    const blocker = node('X', 250, 180, 60, 40)
    const e = edge('S', 'D', [
      [150, 140],
      [150, 200],
      [210, 200],
      [210, 300],
    ])
    const before = structuredClone(e.points)
    snapEdgesToDiamondVertices([e], [S, D, blocker])
    expect(e.points).toEqual(before)
  })

  it('does not touch a rectangle', () => {
    const rect = node('D', 200, 300, 160, 160)
    const e = edge('S', 'D', [
      [150, 140],
      [150, 200],
      [210, 200],
      [210, 300],
    ])
    const before = structuredClone(e.points)
    snapEdgesToDiamondVertices([e], [S, rect])
    expect(e.points).toEqual(before)
  })

  it('does not touch the start of an edge leaving a diamond', () => {
    const t = node('T', 100, 600, 100, 40)
    const e = edge('D', 'T', [
      [250, 460],
      [250, 520],
      [150, 520],
      [150, 600],
    ])
    const before = structuredClone(e.points)
    snapEdgesToDiamondVertices([e], [D, t])
    expect(e.points).toEqual(before)
  })
})

describe('CI/CD sample', () => {
  const p = layoutGraphSync(parseMermaid(CI_CD))
  const f = p.nodes.find((n) => n.id === 'F')!
  const ef = p.edges.find((e) => e.source === 'E' && e.target === 'F')!
  const end = ef.points.at(-1)!

  it('lands Deploy Staging on the top vertex of QA Approved', () => {
    expect(end.x).toBeCloseTo(f.x + f.width / 2, 0)
    expect(end.y).toBeCloseTo(f.y, 0)
  })

  it('stays orthogonal after the move', () => {
    for (let i = 1; i < ef.points.length; i++) {
      const a = ef.points[i - 1]!
      const b = ef.points[i]!
      expect(Math.abs(a.x - b.x) < 1 || Math.abs(a.y - b.y) < 1).toBe(true)
    }
  })

  it('leaves the two edges that fork out of Tests Pass? on their own slopes', () => {
    const b = p.nodes.find((n) => n.id === 'B')!
    const starts = p.edges
      .filter((e) => e.source === 'B')
      .map((e) => e.points[0]!.x)
    // Two different departure points, either side of the centre line.
    expect(new Set(starts.map(Math.round)).size).toBe(2)
    expect(Math.min(...starts)).toBeLessThan(b.x + b.width / 2)
    expect(Math.max(...starts)).toBeGreaterThan(b.x + b.width / 2)
  })
})
