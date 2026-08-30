/**
 * Regression tests for #301 — "ASCII backend: a subgraph that carries no
 * edge is absorbed into an earlier subgraph's frame and its title is
 * deleted."
 *
 * This is the mirror image of #90/#143 (see ascii-subgraph-bbox.test.ts):
 * that fix deferred an edge-less *root* node's placement so it wouldn't be
 * laid out at the shared root level alongside an unrelated sibling
 * subgraph's root. But the deferred node still found its free slot via a
 * subgraph-agnostic blind slide (`reserveSpotInGrid`'s built-in collision
 * handling) — sliding one grid step at a time along the shared axis with no
 * notion of subgraph ownership. When an *earlier* subgraph has such a
 * deferred node AND a *later*, entirely edge-less sibling subgraph already
 * claimed the very next slot, the blind slide walked straight through that
 * later subgraph's root to find free space beyond it — landing the deferred
 * node on the far side. That sandwiched the later subgraph's node between
 * the earlier subgraph's own members, so the earlier subgraph's bounding box
 * (min/max over its members' positions) ballooned out to enclose the later
 * one, corrupting both frames and dropping the later subgraph's title
 * entirely.
 *
 * The fix (`src/ascii/grid.ts`): attach each subgraph's deferred nodes to
 * whichever of its own roots gets placed first, immediately, before control
 * returns to the root-placement loop — so an unrelated subgraph's root can
 * never claim the slot a deferred sibling needs (`deferredByTopSg` /
 * `placeDeferredSiblingsNextToRoot`). A `findSubgraphAdjacentSlot` fallback
 * additionally keeps the later pass (for deferred nodes whose anchor is
 * itself a non-root) from enclosing a foreign subgraph's node when sliding.
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

/** Whether a node's drawn box sits fully inside a subgraph's bounding box. */
function nodeInsideBox(
  graph: AsciiGraph,
  nodeName: string,
  sg: AsciiSubgraph,
): boolean {
  const node = graph.nodes.find((n) => n.name === nodeName)
  if (!node?.drawingCoord || !node.drawing) {
    throw new Error(`node "${nodeName}" wasn't drawn`)
  }
  const minX = node.drawingCoord.x
  const minY = node.drawingCoord.y
  const maxX = minX + node.drawing.length - 1
  const maxY = minY + node.drawing[0]!.length - 1
  return (
    minX >= sg.minX && maxX <= sg.maxX && minY >= sg.minY && maxY <= sg.maxY
  )
}

describe('ASCII: a later edge-less subgraph is not absorbed into an earlier one (#301)', () => {
  const issueRepro = `flowchart TB
  subgraph a["Group A"]
    a1["alpha"]
    a2["bravo"]
    a3["charlie"]
  end
  subgraph b["Group B"]
    b1["delta"]
  end
  a1 --> a2`

  it('keeps two subgraphs disjoint: earlier one has an edge-less member, later one carries no edge at all (exact issue repro)', () => {
    const graph = layoutFlowchart(issueRepro, 'TD')
    expect(graph.subgraphs.length).toBe(2)

    const groupA = findSubgraph(graph, 'Group A')
    const groupB = findSubgraph(graph, 'Group B')
    expect(boxesOverlap(groupA, groupB)).toBe(false)

    // delta belongs to Group B and must be drawn inside Group B's frame,
    // not dragged into Group A's.
    expect(nodeInsideBox(graph, 'b1', groupB)).toBe(true)
    expect(nodeInsideBox(graph, 'b1', groupA)).toBe(false)

    const output = renderMermaidASCII(issueRepro)
    expect(output).toContain('Group A')
    expect(output).toContain('Group B')
  })

  it('keeps the same two subgraphs disjoint in LR', () => {
    const lrSource = issueRepro.replace('flowchart TB', 'flowchart LR')
    const graph = layoutFlowchart(lrSource, 'LR')

    const groupA = findSubgraph(graph, 'Group A')
    const groupB = findSubgraph(graph, 'Group B')
    expect(boxesOverlap(groupA, groupB)).toBe(false)
    expect(nodeInsideBox(graph, 'b1', groupB)).toBe(true)

    const output = renderMermaidASCII(lrSource)
    expect(output).toContain('Group A')
    expect(output).toContain('Group B')
  })

  it('does not collapse a third, equally edge-less subgraph into the same frame (N-subgraph case)', () => {
    const source = `flowchart TB
  subgraph a["Group A"]
    a1["alpha"]
    a2["bravo"]
    a3["charlie"]
  end
  subgraph b["Group B"]
    b1["delta"]
  end
  subgraph c["Group C"]
    c1["echo"]
  end
  a1 --> a2`

    const graph = layoutFlowchart(source, 'TD')
    expect(graph.subgraphs.length).toBe(3)

    const groupA = findSubgraph(graph, 'Group A')
    const groupB = findSubgraph(graph, 'Group B')
    const groupC = findSubgraph(graph, 'Group C')

    for (const [nameI, sgI] of [
      ['Group A', groupA],
      ['Group B', groupB],
      ['Group C', groupC],
    ] as const) {
      for (const [nameJ, sgJ] of [
        ['Group A', groupA],
        ['Group B', groupB],
        ['Group C', groupC],
      ] as const) {
        if (nameI >= nameJ) continue
        expect(
          boxesOverlap(sgI, sgJ),
          `subgraph "${nameI}" overlaps "${nameJ}"`,
        ).toBe(false)
      }
    }

    expect(nodeInsideBox(graph, 'b1', groupB)).toBe(true)
    expect(nodeInsideBox(graph, 'c1', groupC)).toBe(true)
    expect(nodeInsideBox(graph, 'b1', groupA)).toBe(false)
    expect(nodeInsideBox(graph, 'c1', groupA)).toBe(false)

    const output = renderMermaidASCII(source)
    expect(output).toContain('Group A')
    expect(output).toContain('Group B')
    expect(output).toContain('Group C')
  })

  it('OK case: continues to work when every node in the earlier subgraph is on an edge', () => {
    const source = `flowchart TB
  subgraph a["Group A"]
    a1["alpha"]
    a2["bravo"]
  end
  subgraph b["Group B"]
    b1["delta"]
  end
  a1 --> a2`

    const graph = layoutFlowchart(source, 'TD')
    const groupA = findSubgraph(graph, 'Group A')
    const groupB = findSubgraph(graph, 'Group B')
    expect(boxesOverlap(groupA, groupB)).toBe(false)
    expect(nodeInsideBox(graph, 'b1', groupB)).toBe(true)

    const output = renderMermaidASCII(source)
    expect(output).toContain('Group A')
    expect(output).toContain('Group B')
  })
})
