/**
 * Regression tests porting a fix from a stale upstream PR (PR-rescue
 * campaign, issue #258): lukilabs/beautiful-mermaid#152 "fix: honor ELK
 * edge container offsets" by Galen Suen.
 *
 * Background: under ELK's `hierarchyHandling: INCLUDE_CHILDREN` (this
 * repo's `packages/svg-renderer/src/layout-engine/to-elk.ts` uses it when
 * no subgraph has a `direction` override, letting ELK auto-route
 * cross-hierarchy edges instead of decomposing them into hop/bridge edges
 * — see `nested-subgraph-direction-crossing.test.ts` for the SEPARATE/
 * decomposed path used when a direction override *is* present), ELK can
 * leave a cross-hierarchy edge object in an *ancestor* node's `edges`
 * array while reporting its `sections`/`labels` coordinates in the space
 * of the deeper container named by the edge's own (untyped-in-elkjs)
 * `container` property.
 *
 * `packages/svg-renderer/src/layout-engine/from-elk.ts`'s
 * `collectEdgeSegments` walks the ELK result tree and used the offset of
 * whichever array it found an edge object in — which, for exactly this
 * case, is the wrong offset: it doesn't account for the accumulated
 * offset of the container ELK actually placed the edge's coordinates in,
 * shifting nested-subgraph edge endpoints and labels away from the node
 * boundaries they should land on.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../index.ts'
import { layoutGraphSync } from '@zombie-mermaid/svg-renderer'
import type {
  Point,
  PositionedNode,
  PositionedEdge,
  PositionedGraph,
} from '@zombie-mermaid/core'

const EPSILON = 1.5

function onRectBoundary(point: Point, node: PositionedNode): boolean {
  const left = node.x
  const right = node.x + node.width
  const top = node.y
  const bottom = node.y + node.height
  const onHorizontal =
    (Math.abs(point.y - top) <= EPSILON || Math.abs(point.y - bottom) <= EPSILON) &&
    point.x >= left - EPSILON &&
    point.x <= right + EPSILON
  const onVertical =
    (Math.abs(point.x - left) <= EPSILON || Math.abs(point.x - right) <= EPSILON) &&
    point.y >= top - EPSILON &&
    point.y <= bottom + EPSILON
  return onHorizontal || onVertical
}

function expectEdgesMeetNodes(result: PositionedGraph): void {
  const nodes = new Map(result.nodes.map((node) => [node.id, node]))
  for (const edge of result.edges as PositionedEdge[]) {
    const source = nodes.get(edge.source)
    const target = nodes.get(edge.target)
    expect(source, `missing source ${edge.source}`).toBeDefined()
    expect(target, `missing target ${edge.target}`).toBeDefined()
    expect(
      onRectBoundary(edge.points[0]!, source!),
      `edge ${edge.source}->${edge.target} starts off ${edge.source}: ${JSON.stringify(edge.points[0])} vs node at (${source!.x},${source!.y}) ${source!.width}x${source!.height}`,
    ).toBe(true)
    expect(
      onRectBoundary(edge.points.at(-1)!, target!),
      `edge ${edge.source}->${edge.target} ends off ${edge.target}: ${JSON.stringify(edge.points.at(-1))} vs node at (${target!.x},${target!.y}) ${target!.width}x${target!.height}`,
    ).toBe(true)
  }
}

/** No `direction` override anywhere — exercises ELK's INCLUDE_CHILDREN path. */
function nestedDiagram(direction: string): string {
  return `flowchart ${direction}
    subgraph outer["Outer"]
      a["A"]
      subgraph inner["Inner"]
        b["B"]
      end
    end
    a -->|yes| b`
}

describe('nested-subgraph cross-hierarchy edge container offsets', () => {
  it('converts nested cross-container points and labels into root coordinates', () => {
    const result = layoutGraphSync(parseMermaid(nestedDiagram('LR')))
    expectEdgesMeetNodes(result)

    const edge = result.edges[0]!
    const nodeA = result.nodes.find((n) => n.id === 'a')!
    expect(edge.labelPosition).toBeDefined()
    expect(edge.labelPosition!.x).toBeGreaterThan(nodeA.x + nodeA.width)
    expect(Math.abs(edge.labelPosition!.y - edge.points[0]!.y)).toBeLessThan(1)
  })

  it('keeps cross-container endpoints on node boundaries in every root direction', () => {
    for (const direction of ['LR', 'RL', 'TD', 'BT']) {
      const result = layoutGraphSync(parseMermaid(nestedDiagram(direction)))
      expectEdgesMeetNodes(result)
    }
  })

  it('handles three nested containers and edges crossing one, two, and three levels', () => {
    const source = `flowchart LR
      p["Parent"]
      subgraph outer["Outer"]
        m["Middle"]
        subgraph inner["Inner"]
          i["Inner"]
          subgraph deepest["Deepest"]
            d["Deep"]
          end
        end
      end
      p --> m
      p --> i
      p --> d
      m --> i
      i --> d`
    const result = layoutGraphSync(parseMermaid(source))
    expect(result.edges).toHaveLength(5)
    expectEdgesMeetNodes(result)
  })

  it('handles parent-child and sibling container connections', () => {
    const source = `flowchart LR
      subgraph outer["Outer"]
        a["A"]
        subgraph left["Left"]
          b["B"]
        end
        subgraph right["Right"]
          c["C"]
        end
      end
      a --> b
      b --> c`
    const result = layoutGraphSync(parseMermaid(source))
    expect(result.edges).toHaveLength(2)
    expectEdgesMeetNodes(result)
  })

  it('falls back to owning-array offsets for a plain root-level edge (no container tag)', () => {
    const result = layoutGraphSync(parseMermaid('flowchart LR\n  a["A"] -->|yes| b["B"]'))
    expectEdgesMeetNodes(result)
    expect(result.edges[0]!.labelPosition).toBeDefined()
  })
})
