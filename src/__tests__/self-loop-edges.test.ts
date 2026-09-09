/**
 * Self-loop edge rendering (issue #537 follow-up).
 *
 * packages/svg-renderer/src/layout-engine/ (ELK-based flowchart/state
 * layout) previously had no self-loop-specific routing at all: ELK has no
 * native concept of a self-loop, so a `B --> B` edge came back as a
 * degenerate 4-point right-angle polyline sitting on top of the node
 * instead of a loop beside it — see docs/research/537-self-loop-regression-check.md
 * for the before/after comparison against current upstream Mermaid.
 *
 * These tests assert the synthesized replacement: a rounded loop bulging
 * out from the node's right side, discretized into enough points to read
 * as smooth, with the label offset clear of the node.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../parser.ts'
import { layoutGraphSync } from '@zombie-mermaid/svg-renderer'

interface Point {
  x: number
  y: number
}

/** True when the segment p1->p2 runs purely horizontal or vertical. */
function isAxisAligned(p1: Point, p2: Point, tolerance = 0.5): boolean {
  return (
    Math.abs(p2.x - p1.x) < tolerance || Math.abs(p2.y - p1.y) < tolerance
  )
}

describe('self-loop edge routing (flowchart)', () => {
  it('routes a self-loop as a rounded loop beside the node, not a 4-point right-angle bracket', () => {
    const graph = parseMermaid(`flowchart LR
      A --->|foo| B
      B --->|bar| B`)

    const positioned = layoutGraphSync(graph)
    const nodeB = positioned.nodes.find((n) => n.id === 'B')
    const selfLoop = positioned.edges.find(
      (e) => e.source === 'B' && e.target === 'B',
    )

    expect(nodeB).toBeDefined()
    expect(selfLoop).toBeDefined()
    const points = selfLoop!.points

    // The old ELK-routed bracket was exactly 4 points. A real loop needs
    // many more to read as rounded.
    expect(points.length).toBeGreaterThan(4)

    // The bracket was pure right angles throughout. A rounded loop must
    // have a majority of genuinely diagonal segments.
    let diagonalSegments = 0
    for (let i = 1; i < points.length; i++) {
      if (!isAxisAligned(points[i - 1]!, points[i]!)) diagonalSegments++
    }
    expect(diagonalSegments).toBeGreaterThan(points.length / 2)

    // The loop bulges out to the side of the node — every point sits at or
    // beyond the node's right edge — rather than sitting on top of it (the
    // old bracket's points landed inside/just above the node's bounding box).
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(nodeB!.x + nodeB!.width - 0.5)
    }

    // Both ends of the loop attach to the node's right edge.
    expect(points[0]!.x).toBeCloseTo(nodeB!.x + nodeB!.width, 0)
    expect(points[points.length - 1]!.x).toBeCloseTo(
      nodeB!.x + nodeB!.width,
      0,
    )

    // The label sits clear of the node, out past the loop's apex — not on
    // top of the node the way the old bracket's cramped shape forced it to.
    expect(selfLoop!.labelPosition).toBeDefined()
    expect(selfLoop!.labelPosition!.x).toBeGreaterThan(
      nodeB!.x + nodeB!.width,
    )
  })

  it('stacks multiple self-loops on the same node instead of overlapping', () => {
    const graph = parseMermaid(`flowchart LR
      B -->|one| B
      B -->|two| B`)

    const positioned = layoutGraphSync(graph)
    const selfLoops = positioned.edges.filter(
      (e) => e.source === 'B' && e.target === 'B',
    )

    expect(selfLoops).toHaveLength(2)
    const [first, second] = selfLoops as [
      (typeof selfLoops)[0],
      (typeof selfLoops)[0],
    ]

    // The second loop reaches further right than the first, so they nest
    // rather than draw identically on top of each other.
    const apexX = (points: Point[]) => Math.max(...points.map((p) => p.x))
    expect(apexX(second.points)).toBeGreaterThan(apexX(first.points))
  })
})

describe('self-loop edge routing (state diagram)', () => {
  it('routes a state-diagram self-transition as a rounded loop', () => {
    const graph = parseMermaid(`stateDiagram-v2
      [*] --> Idle
      Idle --> Idle: retry`)

    const positioned = layoutGraphSync(graph)
    const selfLoop = positioned.edges.find(
      (e) => e.source === 'Idle' && e.target === 'Idle',
    )

    expect(selfLoop).toBeDefined()
    expect(selfLoop!.points.length).toBeGreaterThan(4)
    expect(selfLoop!.label).toBe('retry')
  })
})
