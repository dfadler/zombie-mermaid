/**
 * Self-loop edge rendering (issue #537 follow-up).
 *
 * packages/svg-renderer/src/layout-engine/ (ELK-based flowchart/state
 * layout) previously had no self-loop-specific routing at all: ELK has no
 * native concept of a self-loop, so a `B --> B` edge came back as a
 * degenerate 4-point right-angle polyline sitting on top of the node
 * instead of a loop beside it — see https://github.com/dfadler/zombie-mermaid/issues/537#issuecomment-6130805676
 * for the before/after comparison against current upstream Mermaid.
 *
 * These tests assert the synthesized replacement: a squared loop on the
 * node's left (TD/BT) or top (LR/RL) face as in mermaid@12.3.0 (#2740), with
 * the label offset clear of the node.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { layoutGraphSync } from '@zombie-mermaid/svg-renderer'

interface Point {
  x: number
  y: number
}

/** True when the segment p1->p2 runs purely horizontal or vertical. */
function isAxisAligned(p1: Point, p2: Point, tolerance = 0.5): boolean {
  return Math.abs(p2.x - p1.x) < tolerance || Math.abs(p2.y - p1.y) < tolerance
}

describe('self-loop edge routing (flowchart)', () => {
  it('routes an LR self-loop as a squared bulge over the top face (#2740)', () => {
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

    // Out of the top face, across, and back in: a squared bulge whose corners
    // the renderer rounds, as in mermaid@12.3.0.
    expect(points).toHaveLength(4)
    for (let i = 1; i < points.length; i++) {
      expect(isAxisAligned(points[i - 1]!, points[i]!)).toBe(true)
    }
    expect(Math.min(...points.map((p) => p.y))).toBeCloseTo(nodeB!.y - 20, 5)
    expect(Math.max(...points.map((p) => p.y))).toBeCloseTo(nodeB!.y, 5)

    // Both ends attach to the top face, inside the node's width.
    expect(points[0]!.x).toBeGreaterThan(nodeB!.x)
    expect(points[3]!.x).toBeLessThan(nodeB!.x + nodeB!.width)

    // The label sits above the apex, clear of the node.
    expect(selfLoop!.labelPosition).toBeDefined()
    expect(selfLoop!.labelPosition!.y).toBeLessThan(nodeB!.y - 20)
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

    // The second loop reaches further out (up) than the first, so they nest.
    const apexY = (points: Point[]) => Math.min(...points.map((p) => p.y))
    expect(apexY(second.points)).toBeLessThan(apexY(first.points))
  })
})

describe('self-loop edge routing (state diagram)', () => {
  it('routes a state-diagram self-transition as a loop', () => {
    const graph = parseMermaid(`stateDiagram-v2
      [*] --> Idle
      Idle --> Idle: retry`)

    const positioned = layoutGraphSync(graph)
    const selfLoop = positioned.edges.find(
      (e) => e.source === 'Idle' && e.target === 'Idle',
    )

    expect(selfLoop).toBeDefined()
    expect(selfLoop!.points).toHaveLength(4)
    expect(selfLoop!.label).toBe('retry')
  })
})
