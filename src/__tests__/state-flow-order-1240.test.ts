/**
 * #1240: in a flat state diagram a back-edge (`Active --> Idle`,
 * `Reconnecting --> Closed`) made ELK reverse the main chain, so the diagram
 * ran bottom-to-top with the `[*]` start beside a state. The start marker now
 * leads, the end marker trails, and the chain reads in declaration order.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../index.ts'
import { layoutGraphSync } from '@zombie-mermaid/svg-renderer'
import type { PositionedGraph, PositionedNode } from '@zombie-mermaid/core'

function layout(src: string): PositionedGraph {
  return layoutGraphSync(parseMermaid(src))
}

function node(g: PositionedGraph, id: string): PositionedNode {
  const n = g.nodes.find((x) => x.id === id)
  if (!n) throw new Error(`no node ${id}`)
  return n
}

const startOf = (g: PositionedGraph) =>
  g.nodes.find((n) => n.shape === 'state-start')!
const endOf = (g: PositionedGraph) =>
  g.nodes.find((n) => n.shape === 'state-end')!

describe('flat state diagrams read top to bottom (#1240)', () => {
  it('basic: start, Idle, Active, Done, end run down the page', () => {
    const g = layout(`stateDiagram-v2
  [*] --> Idle
  Idle --> Active : start
  Active --> Idle : cancel
  Active --> Done : complete
  Done --> [*]`)
    const ys = [
      startOf(g).y,
      node(g, 'Idle').y,
      node(g, 'Active').y,
      node(g, 'Done').y,
      endOf(g).y,
    ]
    expect(ys).toEqual([...ys].sort((a, b) => a - b))
    expect(new Set(ys).size).toBe(ys.length)
  })

  it('connection lifecycle: start leads, Closed follows it, end trails everything', () => {
    const g = layout(`stateDiagram-v2
  [*] --> Closed
  Closed --> Connecting : connect
  Connecting --> Connected : success
  Connecting --> Closed : timeout
  Connected --> Disconnecting : close
  Connected --> Reconnecting : error
  Reconnecting --> Connected : success
  Reconnecting --> Closed : max_retries
  Disconnecting --> Closed : done
  Closed --> [*]`)
    const start = startOf(g)
    const end = endOf(g)
    const others = g.nodes.filter((n) => n !== start && n !== end)
    for (const n of others) expect(start.y).toBeLessThan(n.y)
    for (const n of others) expect(end.y).toBeGreaterThan(n.y)
    expect(node(g, 'Closed').y).toBeLessThan(node(g, 'Connecting').y)
    expect(node(g, 'Connecting').y).toBeLessThan(node(g, 'Connected').y)
    expect(node(g, 'Connected').y).toBeLessThan(node(g, 'Reconnecting').y)
    expect(node(g, 'Connected').y).toBeLessThan(node(g, 'Disconnecting').y)
    // The start marker sits above its target, not beside it.
    const closed = node(g, 'Closed')
    expect(start.y + start.height).toBeLessThanOrEqual(closed.y)
  })

  it('every edge ends with a vertical run, so arrowheads point straight into the node', () => {
    const g = layout(`stateDiagram-v2
  [*] --> Closed
  Closed --> Connecting : connect
  Connecting --> Connected : success
  Connecting --> Closed : timeout
  Connected --> Disconnecting : close
  Connected --> Reconnecting : error
  Reconnecting --> Connected : success
  Reconnecting --> Closed : max_retries
  Disconnecting --> Closed : done
  Closed --> [*]`)
    for (const e of g.edges) {
      const [a, b] = e.points.slice(-2)
      expect(Math.abs(a!.x - b!.x), `${e.source}->${e.target}`).toBeLessThan(
        0.5,
      )
    }
  })
})
