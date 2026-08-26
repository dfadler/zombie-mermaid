/**
 * Regression tests for #90 — "ASCII: edge-less node inside a subgraph merges
 * that subgraph's frame with a neighboring one."
 *
 * Root cause: root-node placement in `createMapping` (src/ascii/grid.ts) was
 * entirely subgraph-agnostic. An edge-less node (treated as an initial "root"
 * since it has no incoming edges) could land in the same row/column band as
 * an unrelated sibling subgraph's real root, purely because both were
 * "roots" and roots were laid out along one shared level regardless of which
 * subgraph they belonged to. That made one subgraph's bounding box (computed
 * as min/max over its members' actual positions) balloon out to enclose a
 * completely unrelated sibling subgraph, corrupting both frames' borders and
 * titles when drawn.
 *
 * The fix defers placement of root nodes that belong to a subgraph with
 * *other* members that are unreachable from that root, anchoring them next
 * to their already-placed subgraph siblings instead of the shared root
 * level. See `src/ascii/grid.ts`'s `createMapping` (deferredRoots handling).
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../parser.ts'
import { convertToAsciiGraph } from '../ascii/converter.ts'
import { createMapping } from '../ascii/grid.ts'
import { renderMermaidASCII } from '../ascii/index.ts'
import type { AsciiConfig, AsciiGraph, AsciiSubgraph } from '../ascii/types.ts'

function layoutFlowchart(
  source: string,
  direction: 'TD' | 'LR' = 'TD',
): AsciiGraph {
  const parsed = parseMermaid(source)
  const config: AsciiConfig = {
    useAscii: false,
    paddingX: 5,
    paddingY: 5,
    boxBorderPadding: 1,
    graphDirection: direction,
  }
  const graph = convertToAsciiGraph(parsed, config)
  createMapping(graph)
  return graph
}

function boxesOverlap(a: AsciiSubgraph, b: AsciiSubgraph): boolean {
  return !(
    a.maxX <= b.minX ||
    b.maxX <= a.minX ||
    a.maxY <= b.minY ||
    b.maxY <= a.minY
  )
}

function findSubgraph(graph: AsciiGraph, name: string): AsciiSubgraph {
  const sg = graph.subgraphs.find((s) => s.name === name)
  if (!sg) throw new Error(`subgraph "${name}" not found`)
  return sg
}

describe('ASCII subgraph bounding boxes stay disjoint (#90)', () => {
  const issueRepro = `flowchart TB
  subgraph a["Frontend tier"]
    a1["load balancer"]
  end
  subgraph b["Application tier"]
    b1["worker pool"]
    b2["api server"]
  end
  a1 --> b1`

  it('keeps an edge-less subgraph member from merging with a sibling subgraph (TD, exact issue repro)', () => {
    const graph = layoutFlowchart(issueRepro, 'TD')
    expect(graph.subgraphs.length).toBe(2)

    const frontend = findSubgraph(graph, 'Frontend tier')
    const application = findSubgraph(graph, 'Application tier')
    expect(boxesOverlap(frontend, application)).toBe(false)

    const output = renderMermaidASCII(issueRepro)
    expect(output).toContain('Frontend tier')
    expect(output).toContain('Application tier')
    // Guard against the exact corrupted-title symptom from the issue, where
    // the two titles interleaved character-by-character into
    // "Frontendptieration tier".
    expect(output).not.toContain('Frontendptieration')
  })

  it('keeps an edge-less subgraph member from merging with a sibling subgraph (LR)', () => {
    const lrSource = issueRepro.replace('flowchart TB', 'flowchart LR')
    const graph = layoutFlowchart(lrSource, 'LR')

    const frontend = findSubgraph(graph, 'Frontend tier')
    const application = findSubgraph(graph, 'Application tier')
    expect(boxesOverlap(frontend, application)).toBe(false)

    const output = renderMermaidASCII(lrSource)
    expect(output).toContain('Frontend tier')
    expect(output).toContain('Application tier')
  })

  it('keeps multiple subgraphs — each with its own root plus an edge-less sibling — mutually disjoint', () => {
    const source = `flowchart TD
  subgraph a["Alpha"]
    a1["root"]
  end
  subgraph b["Beta"]
    b1["worker"]
    b2["idle"]
  end
  subgraph c["Gamma"]
    c1["worker"]
    c2["idle"]
  end
  a1 --> b1
  b1 --> c1`

    const graph = layoutFlowchart(source, 'TD')
    expect(graph.subgraphs.length).toBe(3)

    for (let i = 0; i < graph.subgraphs.length; i++) {
      for (let j = i + 1; j < graph.subgraphs.length; j++) {
        const sgI = graph.subgraphs[i]!
        const sgJ = graph.subgraphs[j]!
        expect(
          boxesOverlap(sgI, sgJ),
          `subgraph "${sgI.name}" overlaps "${sgJ.name}"`,
        ).toBe(false)
      }
    }

    const output = renderMermaidASCII(source)
    expect(output).toContain('Alpha')
    expect(output).toContain('Beta')
    expect(output).toContain('Gamma')
  })
})
