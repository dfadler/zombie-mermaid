/**
 * Regression test for #444 — "Flowchart: nested subgraph left-right order
 * doesn't match mermaid.js."
 *
 * Root cause: `placeReachableChildren` (src/ascii/grid.ts) placed a node's
 * children in raw edge-declaration order, so for
 *
 *   subgraph Cloud
 *     subgraph us-east [US East Region]
 *       A[Web Server] --> B[App Server]
 *     end
 *     subgraph us-west [US West Region]
 *       C[Web Server] --> D[App Server]
 *     end
 *   end
 *   E[Load Balancer] --> A
 *   E --> C
 *
 * `E`'s children were placed in the order its outgoing edges were declared
 * (`E --> A` before `E --> C`), putting `us-east` on the left and `us-west`
 * on the right. Real mermaid.js (verified against its bundled
 * flowDb.getData() — see the comment on `compareBySiblingSubgraphOrder` in
 * src/ascii/grid.ts, and the matching comment in
 * src/layout-engine/to-elk.ts's `mermaidToElk`) instead orders sibling
 * subgraphs in *reversed declaration order*, independent of which one a
 * shared parent's edges happen to target first — putting `us-west` (the
 * second-declared sibling) on the left and `us-east` on the right.
 *
 * The fix adds `compareBySiblingSubgraphOrder` to reorder same-level
 * children that land in different sibling subgraphs, plus a matching fix to
 * `placeReachableChildren`'s outer traversal order (visiting placed nodes in
 * cross-axis order rather than raw declaration order) so a child's
 * column/row stays aligned with its own parent once sibling order can
 * diverge from declaration order.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../parser.ts'
import { convertToAsciiGraph } from '../ascii/converter.ts'
import { createMapping } from '../ascii/grid.ts'
import { renderMermaidASCII } from '../ascii/index.ts'
import type { AsciiConfig, AsciiGraph } from '../ascii/types.ts'
import { requireGridCoord } from '../ascii/types.ts'

function layoutFlowchart(source: string): AsciiGraph {
  const parsed = parseMermaid(source)
  const config: AsciiConfig = {
    useAscii: false,
    paddingX: 5,
    paddingY: 5,
    boxBorderPadding: 1,
    graphDirection: 'TD',
  }
  const graph = convertToAsciiGraph(parsed, config)
  createMapping(graph)
  return graph
}

function findNode(graph: AsciiGraph, name: string) {
  const node = graph.nodes.find((n) => n.name === name)
  if (!node) throw new Error(`node "${name}" not found`)
  return node
}

describe('ASCII nested-subgraph sibling left-right order matches mermaid.js (#444)', () => {
  const repro = `graph TD
  subgraph Cloud
    subgraph us-east [US East Region]
      A[Web Server] --> B[App Server]
    end
    subgraph us-west [US West Region]
      C[Web Server] --> D[App Server]
    end
  end
  E[Load Balancer] --> A
  E --> C`

  it('places us-west (declared second) left of us-east (declared first)', () => {
    const graph = layoutFlowchart(repro)
    const a = requireGridCoord(findNode(graph, 'A')) // us-east member
    const c = requireGridCoord(findNode(graph, 'C')) // us-west member
    expect(c.x).toBeLessThan(a.x)
  })

  it('keeps each nested subgraph member aligned in the same column as its sibling', () => {
    const graph = layoutFlowchart(repro)
    const a = requireGridCoord(findNode(graph, 'A'))
    const b = requireGridCoord(findNode(graph, 'B'))
    const c = requireGridCoord(findNode(graph, 'C'))
    const d = requireGridCoord(findNode(graph, 'D'))
    expect(b.x).toBe(a.x) // A --> B stay in us-east's column
    expect(d.x).toBe(c.x) // C --> D stay in us-west's column
  })

  it('renders "US West" before "US East" in the ASCII output', () => {
    // The label may wrap around a routed edge line (e.g. "US East│Region"),
    // so match on the unambiguous "US West"/"US East" prefix rather than
    // the full two-word label.
    const output = renderMermaidASCII(repro)
    const westIdx = output.indexOf('US West')
    const eastIdx = output.indexOf('US East')
    expect(westIdx).toBeGreaterThan(-1)
    expect(eastIdx).toBeGreaterThan(-1)
    expect(westIdx).toBeLessThan(eastIdx)
  })
})
