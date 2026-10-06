/**
 * #1349: a back edge that has to go round a node is one clean loop, not a
 * staircase with an extra jog. Three causes are covered:
 *  - a reroute blocked one cell at a time and the search sidestepped by a cell,
 *    leaving a staircase (rerouted edges now prefer fewest bends);
 *  - a chain whose two legs end at different corners (`D --> A`, `A --> C`, both
 *    on A's right) was routed apart although port-offsets.ts draws them apart;
 *  - a long label on a short hop widened a node's own border column, inflating
 *    the node's box and everything in its column.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { convertToAsciiGraph } from '../converter.ts'
import { createMapping } from '../grid.ts'
import type { AsciiGraph } from '../types.ts'

function layout(source: string): AsciiGraph {
  const graph = convertToAsciiGraph(parseMermaid(source), {
    useAscii: false,
    paddingX: 5,
    paddingY: 5,
    boxBorderPadding: 1,
    graphDirection: 'TD',
  })
  createMapping(graph)
  return graph
}

const edge = (g: AsciiGraph, from: string, to: string) =>
  g.edges.find((e) => e.from.name === from && e.to.name === to)!

const DENSE = `graph TD
A -->|x| B
B -->|long label| A
A -->|long label| C
C -->|ab| A
B -->|mid| D
A -->|ab| D
D -->|x| A`

describe('ASCII back-edge loop (#1349)', () => {
  it('routes D --> A as one loop round B, four points and three bends', () => {
    const path = edge(layout(DENSE), 'D', 'A').path
    // Out of D's right side, up the free column, into A's right side.
    expect(path).toHaveLength(4)
  })

  it('does not jog above A before entering its right side', () => {
    const path = edge(layout(DENSE), 'D', 'A').path
    // The last leg is a straight run into A, not a hop over the top row.
    const last = path[path.length - 1]!
    const before = path[path.length - 2]!
    expect(before.y).toBe(last.y)
    expect(Math.min(...path.map((p) => p.y))).toBe(last.y)
  })

  it('does not inflate a node to fit a long label on a short hop', () => {
    const out = renderMermaidASCII(
      `stateDiagram-v2
  [*] --> Closed
  Closed --> Connecting : connect
  Connecting --> Connected : success
  Connecting --> Closed : timeout
  Connected --> Disconnecting : close
  Connected --> Reconnecting : error
  Reconnecting --> Connected : success
  Reconnecting --> Closed : max_retries
  Disconnecting --> Closed : done
  Closed --> [*]`,
      { colorMode: 'none' },
    )
    // `Reconnecting` keeps its own 14-wide box rather than growing to hold
    // `max_retries` plus padding in its border column.
    expect(out).toMatch(/│ Reconnecting [│├]/)
    expect(out).toContain('max_retries')
  })
})
