/**
 * #1239: an edge from a node past the end of a subgraph back to a node inside
 * it (`F -->|No| D`) was routed by ELK up the side and over the top of the
 * whole subgraph, a long loop that also crossed the subgraph title. It now
 * enters the subgraph through its downstream wall, straight into the target.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../index.ts'
import { layoutGraphSync } from '@zombie-mermaid/svg-renderer'
import { routeBackEdgesIntoGroups } from '../../packages/svg-renderer/src/layout-engine/back-edge-routing.ts'
import type {
  PositionedEdge,
  PositionedGroup,
  PositionedNode,
} from '@zombie-mermaid/core'

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
  w = 100,
  h = 40,
): PositionedNode {
  return { id, x, y, width: w, height: h } as PositionedNode
}

function group(x: number, y: number, w: number, h: number): PositionedGroup {
  return { id: 'g', label: 'G', x, y, width: w, height: h, children: [] }
}

function edge(
  source: string,
  target: string,
  points: Array<[number, number]>,
  label?: string,
): PositionedEdge {
  return {
    source,
    target,
    label,
    style: 'solid',
    hasArrowStart: false,
    hasArrowEnd: true,
    points: points.map(([x, y]) => ({ x, y })),
  } as PositionedEdge
}

/**
 * TD scene: group (0,0)-(300,200) holding T at (100,100); S below it at
 * (100,300). ELK's loop goes up the right side, over the top and back down.
 */
const loop = (): PositionedEdge =>
  edge('S', 'T', [
    [150, 300],
    [150, 260],
    [340, 260],
    [340, -20],
    [150, -20],
    [150, 100],
  ])

describe('routeBackEdgesIntoGroups', () => {
  const T = node('T', 100, 100)
  const S = node('S', 100, 300)

  it('enters the group through its downstream wall into the target', () => {
    const e = loop()
    routeBackEdgesIntoGroups([e], [group(0, 0, 300, 200)], [T, S], 'TD')
    // Up from the source to just past the wall, then into T's bottom (y=140).
    expect(e.points).toEqual([
      { x: 150, y: 300 },
      { x: 150, y: 214 },
      { x: 150, y: 214 },
      { x: 150, y: 140 },
    ])
  })

  it('never goes above the group any more', () => {
    const e = loop()
    routeBackEdgesIntoGroups([e], [group(0, 0, 300, 200)], [T, S], 'TD')
    expect(Math.min(...e.points.map((p) => p.y))).toBeGreaterThanOrEqual(140)
  })

  it('moves the label onto the cross run', () => {
    const t = node('T', 20, 100)
    const e = edge(
      'S',
      'T',
      [
        [150, 300],
        [150, 260],
        [340, 260],
        [340, -20],
        [70, -20],
        [70, 100],
      ],
      'No',
    )
    routeBackEdgesIntoGroups([e], [group(0, 0, 300, 200)], [t, S], 'TD')
    // A quarter of the way from x=150 to the target's centre x=70.
    expect(e.labelPosition).toEqual({ x: 130, y: 214 })
  })

  it('works for left-to-right flow', () => {
    // Same scene turned on its side: flow runs along x, group spans x 0..200.
    const t = node('T', 100, 100, 40, 100)
    const s = node('S', 300, 100, 40, 100)
    const e = edge('S', 'T', [
      [300, 150],
      [260, 150],
      [260, 340],
      [-20, 340],
      [-20, 150],
      [100, 150],
    ])
    routeBackEdgesIntoGroups([e], [group(0, 0, 200, 300)], [t, s], 'LR')
    expect(e.points[1]).toEqual({ x: 214, y: 150 })
    expect(e.points.at(-1)).toEqual({ x: 140, y: 150 })
  })

  it('works for bottom-to-top flow', () => {
    // BT: the flow runs up, so "downstream" is the top. Source above the group.
    const t = node('T', 100, 60)
    const s = node('S', 100, -200)
    const e = edge('S', 'T', [
      [150, -160],
      [150, -120],
      [340, -120],
      [340, 220],
      [150, 220],
      [150, 100],
    ])
    routeBackEdgesIntoGroups([e], [group(0, 0, 300, 200)], [t, s], 'BT')
    expect(e.points.at(-1)).toEqual({ x: 150, y: 60 })
    // Everything before the final point stays clear of the group, above y=0.
    expect(
      Math.max(...e.points.slice(0, -1).map((p) => p.y)),
    ).toBeLessThanOrEqual(-14)
  })

  it('leaves an edge that does not loop over the upstream end', () => {
    const e = edge('S', 'T', [
      [150, 300],
      [150, 260],
      [150, 100],
    ])
    const before = structuredClone(e.points)
    routeBackEdgesIntoGroups([e], [group(0, 0, 300, 200)], [T, S], 'TD')
    expect(e.points).toEqual(before)
  })

  it('leaves an edge whose source is inside the group', () => {
    const inside = node('S', 100, 20)
    const e = edge('S', 'T', [
      [150, 20],
      [340, 20],
      [340, -20],
      [150, -20],
      [150, 100],
    ])
    const before = structuredClone(e.points)
    routeBackEdgesIntoGroups([e], [group(0, 0, 300, 200)], [T, inside], 'TD')
    expect(e.points).toEqual(before)
  })

  it('keeps ELK route when another node is in the way', () => {
    const blocker = node('X', 100, 220)
    const e = loop()
    const before = structuredClone(e.points)
    routeBackEdgesIntoGroups(
      [e],
      [group(0, 0, 300, 200)],
      [T, S, blocker],
      'TD',
    )
    expect(e.points).toEqual(before)
  })

  it('keeps ELK route when there is no room between source and group', () => {
    const close = node('S', 100, 210)
    const e = edge('S', 'T', [
      [150, 210],
      [340, 210],
      [340, -20],
      [150, -20],
      [150, 100],
    ])
    const before = structuredClone(e.points)
    routeBackEdgesIntoGroups([e], [group(0, 0, 300, 200)], [T, close], 'TD')
    expect(e.points).toEqual(before)
  })

  it('ignores an edge with no group involved', () => {
    const e = loop()
    const before = structuredClone(e.points)
    routeBackEdgesIntoGroups([e], [], [T, S], 'TD')
    expect(e.points).toEqual(before)
  })
})

describe('CI/CD sample', () => {
  const p = layoutGraphSync(parseMermaid(CI_CD))
  const ci = p.groups[0]!
  const fd = p.edges.find((e) => e.source === 'F' && e.target === 'D')!
  const d = p.nodes.find((n) => n.id === 'D')!

  it('keeps the "No" back-edge below the top of the subgraph', () => {
    expect(Math.min(...fd.points.map((q) => q.y))).toBeGreaterThan(ci.y)
  })

  it('ends the "No" back-edge at the bottom of Fix & Retry', () => {
    const end = fd.points.at(-1)!
    expect(end.y).toBeCloseTo(d.y + d.height, 0)
    expect(end.x).toBeGreaterThan(d.x)
    expect(end.x).toBeLessThan(d.x + d.width)
  })

  it('is a short route, not a loop around the diagram', () => {
    const length = fd.points.reduce(
      (sum, q, i) =>
        i === 0
          ? 0
          : sum +
            Math.abs(q.x - fd.points[i - 1]!.x) +
            Math.abs(q.y - fd.points[i - 1]!.y),
      0,
    )
    expect(length).toBeLessThan(ci.height)
  })

  it('keeps the label off the Build Image to Deploy Staging edge', () => {
    const label = fd.labelPosition!
    const ce = p.edges.find((e) => e.source === 'C' && e.target === 'E')!
    const x = ce.points[0]!.x
    // Label is about 40px wide.
    expect(Math.abs(label.x - x)).toBeGreaterThan(24)
  })
})
