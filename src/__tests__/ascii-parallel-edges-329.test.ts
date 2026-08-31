/**
 * Regression tests for #329: two (or more) edges between the *same* pair of
 * nodes — true parallel/multi-edges, e.g. `A -->|One| B` followed by
 * `A -->|Two| B` — used to all compute the identical center path
 * (determinePath had no notion of sibling parallel edges), so only one
 * visible line was drawn and each edge's independently-centered label
 * (determineLabelLine) landed a few columns apart from its sibling's on
 * that same shared line, silently overwriting characters instead of one
 * edge cleanly winning. The exact repro from the issue rendered
 * `SFirst Arrow` — a corrupted overlay of "Second Arrow" and "First Arrow".
 *
 * The fix (edge-routing.ts):
 *  - `assignParallelEdgeLanes` tags every edge past the first in such a
 *    group with a lane index.
 *  - `determinePath` routes lane-indexed edges through an offset lane
 *    (`buildParallelLanePath`) instead of the shared center path.
 *  - `determineLabelLine` additionally refuses to place a label on a
 *    segment whose interior runs through a node's own reserved cells
 *    (`clearOfNodes`), so a lane's short jog back into the target node
 *    can't be mistaken for a good label segment.
 *  - `canBundle` (edge-bundling.ts) refuses to fold a true-parallel group
 *    into one shared fan-in/fan-out trunk, which would otherwise silently
 *    merge unlabeled duplicate edges into a single visible line.
 *
 * A second bug (caught in code review before merge, not by the original
 * issue): `buildParallelLanePath`'s first version descended straight down
 * the source's/target's *own* border column before crossing to the offset
 * lane. That's fine for an isolated `A`/`B` pair, but an unrelated node
 * placed directly below `A`/`B` — a completely ordinary "second,
 * independent flow stacked under the first" layout, e.g. `X --> Y` right
 * under `A --> B` — naturally shares that exact column, so the straight
 * descent ran straight through the unrelated node's own reserved block.
 * The fix tries a "wide" candidate lane first and falls back to routing the
 * two short jogs through the permanently node-free gutter column/row
 * between grid levels when "wide" collides with something. See that
 * function's own doc for the full reasoning.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../parser.ts'
import { convertToAsciiGraph } from '../ascii/converter.ts'
import { createMapping } from '../ascii/grid.ts'
import { renderMermaidASCII } from '../ascii/index.ts'
import { pathCells, isOccupied } from '../ascii/grid-occupancy.ts'
import type {
  AsciiConfig,
  AsciiEdge,
  AsciiGraph,
  AsciiNode,
} from '../ascii/types.ts'

function buildGraph(source: string, graphDirection: 'LR' | 'TD'): AsciiGraph {
  const parsed = parseMermaid(source)
  const config: AsciiConfig = {
    useAscii: false,
    paddingX: 5,
    paddingY: 5,
    boxBorderPadding: 1,
    graphDirection,
  }
  const graph = convertToAsciiGraph(parsed, config)
  createMapping(graph)
  return graph
}

function edgesBetween(
  graph: AsciiGraph,
  fromName: string,
  toName: string,
): AsciiEdge[] {
  return graph.edges.filter(
    (e) => e.from.name === fromName && e.to.name === toName,
  )
}

function pathKey(path: AsciiEdge['path']): string {
  return path.map((c) => `${c.x},${c.y}`).join('|')
}

describe('parallel edges between the same node pair (#329)', () => {
  it('the exact issue repro: two labeled LR edges render both labels intact, uncorrupted', () => {
    const out = renderMermaidASCII(`flowchart LR
    A -->|First Arrow| B
    A -->|Second Arrow| B`)

    // The label's own space character doesn't overwrite the arrow line
    // drawn underneath it (see canvas.ts's drawText), so "First Arrow"
    // renders as e.g. "First─Arrow" — assert on the two words rather than
    // a literal space.
    expect(out).toMatch(/First.Arrow/)
    expect(out).toMatch(/Second.Arrow/)
    // The reported corruption: the leading "S" from "Second Arrow" bleeding
    // into "First Arrow" because both labels were centered on the same
    // shared line a few columns apart.
    expect(out).not.toMatch(/SFirst.Arrow/)
  })

  it('routes the two edges through distinct, non-identical paths', () => {
    const graph = buildGraph(
      `flowchart LR
    A -->|First Arrow| B
    A -->|Second Arrow| B`,
      'LR',
    )
    const [first, second] = edgesBetween(graph, 'A', 'B')
    expect(first).toBeDefined()
    expect(second).toBeDefined()
    expect(pathKey(first!.path)).not.toBe(pathKey(second!.path))
  })

  it('gives each edge a labelLine whose open (non-node) cells do not overlap the other edge’s', () => {
    const graph = buildGraph(
      `flowchart LR
    A -->|First Arrow| B
    A -->|Second Arrow| B`,
      'LR',
    )
    const [first, second] = edgesBetween(graph, 'A', 'B')
    const firstCells = new Set(pathCells(first!.labelLine).map(pathKeyOf))
    const overlap = pathCells(second!.labelLine)
      .map(pathKeyOf)
      .filter((k) => firstCells.has(k))
    expect(overlap).toEqual([])
  })

  it('3 parallel labeled edges: all three labels render intact', () => {
    const out = renderMermaidASCII(`flowchart LR
    A -->|One| B
    A -->|Two| B
    A -->|Three| B`)

    expect(out).toContain('One')
    expect(out).toContain('Two')
    expect(out).toContain('Three')
  })

  it('3 parallel edges route through 3 distinct paths', () => {
    const graph = buildGraph(
      `flowchart LR
    A -->|One| B
    A -->|Two| B
    A -->|Three| B`,
      'LR',
    )
    const edges = edgesBetween(graph, 'A', 'B')
    expect(edges).toHaveLength(3)
    const keys = new Set(edges.map((e) => pathKey(e.path)))
    expect(keys.size).toBe(3)
  })

  it('parallel edges where only one of the pair has a label: the label renders intact', () => {
    const out = renderMermaidASCII(`flowchart LR
    A -->|Labeled| B
    A --> B`)

    expect(out).toContain('Labeled')
  })

  it('parallel edges where only one of the pair has a label: routes through distinct paths', () => {
    const graph = buildGraph(
      `flowchart LR
    A -->|Labeled| B
    A --> B`,
      'LR',
    )
    const edges = edgesBetween(graph, 'A', 'B')
    expect(edges).toHaveLength(2)
    expect(pathKey(edges[0]!.path)).not.toBe(pathKey(edges[1]!.path))
  })

  it('parallel edges with different arrow/line styles: both labels render intact and paths stay distinct', () => {
    const out = renderMermaidASCII(`flowchart LR
    A -->|Solid| B
    A -.->|Dotted| B`)

    expect(out).toContain('Solid')
    expect(out).toContain('Dotted')

    const graph = buildGraph(
      `flowchart LR
    A -->|Solid| B
    A -.->|Dotted| B`,
      'LR',
    )
    const edges = edgesBetween(graph, 'A', 'B')
    expect(edges.map((e) => e.style).sort()).toEqual(['dotted', 'solid'])
    expect(pathKey(edges[0]!.path)).not.toBe(pathKey(edges[1]!.path))
  })

  it('TD direction: two labeled parallel edges render both labels intact, without either bleeding into the target box border', () => {
    const out = renderMermaidASCII(`flowchart TD
    A -->|First Arrow| B
    A -->|Second Arrow| B`)

    expect(out).toMatch(/First.Arrow/)
    expect(out).toMatch(/Second.Arrow/)

    // Regression for a bug found while building this fix: the offset
    // lane's jog back into B ran directly along B's own top border row,
    // and determineLabelLine picked that segment (by a width-only
    // heuristic) as the "best" place for the label — drawing label text
    // straight through the border's connector glyph, e.g.
    // "Second┬Arrow" fused into B's own top border row. (A '┬' elsewhere
    // — e.g. where the two edges legitimately split just below A — is
    // fine; only the label fusing with one is the bug.)
    expect(out).not.toContain('Second┬Arrow')
    expect(out).not.toContain('First┬Arrow')
  })

  it('TD direction: unlabeled parallel edges do not collapse into a single fan-in/fan-out bundle', () => {
    const graph = buildGraph(
      `flowchart TD
    A --> B
    A --> B`,
      'TD',
    )
    const edges = edgesBetween(graph, 'A', 'B')
    expect(edges).toHaveLength(2)
    // Before the canBundle fix, this exact degenerate case (both "fan-in"
    // and "fan-out" candidates share not just one endpoint but both) could
    // be folded into a single bundle/junction, visually merging the two
    // edges into what looks like one line.
    expect(pathKey(edges[0]!.path)).not.toBe(pathKey(edges[1]!.path))
  })

  it('a self-loop is not affected by parallel-lane assignment', () => {
    const graph = buildGraph(
      `flowchart LR
    A -->|Self| A
    A -->|Other| B`,
      'LR',
    )
    const selfLoop = graph.edges.find((e) => e.from === e.to)
    expect(selfLoop).toBeDefined()
    expect(selfLoop!.parallelLane).toBeUndefined()
  })

  it('a single (non-parallel) labeled edge is completely unaffected: no lane assigned', () => {
    const graph = buildGraph(
      `flowchart LR
    A -->|Only| B`,
      'LR',
    )
    const [only] = edgesBetween(graph, 'A', 'B')
    expect(only!.parallelLane).toBeUndefined()
  })

  describe('offset lanes never cross an unrelated node sharing the same border column/row', () => {
    // A -->/--> B (parallel), with an independent X --> Y chain placed
    // directly below A/B. In LR layout, X lands on A's own column and Y on
    // B's own column — the exact shape that made an earlier version of
    // buildParallelLanePath route straight through X's/Y's reserved block.
    const LR_SOURCE = `flowchart LR
    A -->|One| B
    A -->|Two| B
    A -->|Three| B
    A -->|Four| B
    X --> Y`

    function interiorCellsOccupiedByForeignNode(
      graph: AsciiGraph,
      edge: AsciiEdge,
    ): { x: number; y: number }[] {
      const isOwn = (n: AsciiNode, c: { x: number; y: number }) => {
        const gc = n.gridCoord
        return (
          gc !== null &&
          c.x >= gc.x &&
          c.x <= gc.x + 2 &&
          c.y >= gc.y &&
          c.y <= gc.y + 2
        )
      }
      const cells = pathCells(edge.path)
      return cells
        .slice(1, -1)
        .filter(
          (c) =>
            isOccupied(graph.grid, c) &&
            !isOwn(edge.from, c) &&
            !isOwn(edge.to, c),
        )
    }

    it('no lane path passes through a cell owned by the unrelated X/Y chain', () => {
      const graph = buildGraph(LR_SOURCE, 'LR')
      const edges = edgesBetween(graph, 'A', 'B')
      expect(edges).toHaveLength(4)
      for (const edge of edges) {
        const foreign = interiorCellsOccupiedByForeignNode(graph, edge)
        expect(foreign).toEqual([])
      }
    })

    it('every lane in the group still routes through a distinct path', () => {
      const graph = buildGraph(LR_SOURCE, 'LR')
      const edges = edgesBetween(graph, 'A', 'B')
      const keys = new Set(edges.map((e) => pathKey(e.path)))
      expect(keys.size).toBe(edges.length)
    })

    it('every label renders intact in the full render', () => {
      const out = renderMermaidASCII(LR_SOURCE)
      for (const label of ['One', 'Two', 'Three', 'Four']) {
        expect(out).toContain(label)
      }
    })
  })
})

function pathKeyOf(c: { x: number; y: number }): string {
  return `${c.x},${c.y}`
}
