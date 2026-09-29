/**
 * Cluster-boundary edge exits (#1148, fixing #1135 / #1156): when 2+ edges
 * leave a cluster, they share one stub across the cluster's flow-side wall
 * to a gutter cell past it, instead of each edge being routed independently
 * from the stand-in member node (which punched some of them through the
 * member's own side).
 *
 * Test order follows the design note
 * (docs/decisions/cluster-exit-anchoring-1148-prerequisites-1164-1165.md).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { parseMermaid } from '../../../../src/parser.ts'
import { convertToAsciiGraph } from '../converter.ts'
import { createMapping } from '../grid.ts'
import type { AsciiConfig } from '../types.ts'

const render = (src: string, opts: Record<string, unknown> = {}): string[] =>
  renderMermaidASCII(src, { colorMode: 'none', ...opts })
    .split('\n')
    .map((l) => l.trimEnd())

/** Lay out `src` and return the graph, to inspect plans and boxes. */
function layout(src: string, config: Partial<AsciiConfig> = {}) {
  const graph = convertToAsciiGraph(parseMermaid(src), {
    useAscii: false,
    paddingX: 6,
    paddingY: 5,
    boxBorderPadding: 1,
    graphDirection: /^\s*(flowchart|graph)\s+LR/.test(src) ? 'LR' : 'TD',
    ...config,
  })
  createMapping(graph)
  return graph
}

const FLOW_TWIN = `flowchart TD
  Start --> Idle
  Idle --> Processing
  subgraph Processing
    N
  end
  Processing -->|done| Done
  Processing -->|fail| Error
`

const COMPOSITE_STATE = `stateDiagram-v2
  [*] --> Idle
  Idle --> Processing
  state Processing {
    [*] --> execute
  }
  Processing --> Done: done
  Processing --> Error: fail
`

/** Row index of the cluster's bottom wall: a `└──…──┘` row. */
const wallRow = (lines: string[]): number =>
  lines.findIndex((l) => /^└[─┼┬┴┤├]+┘/.test(l))

describe('cluster-exit anchoring: labeled multi-exit primary repro (#1135)', () => {
  it.each([
    ['plain flowchart twin', FLOW_TWIN],
    ['composite state', COMPOSITE_STATE],
  ])('%s: both exits leave through the flow-side wall', (_name, src) => {
    const lines = render(src)
    const wall = wallRow(lines)
    expect(wall).toBeGreaterThan(-1)

    // No label overwrites the cluster's border row.
    expect(lines[wall]).not.toMatch(/done|fail/)
    // Both labels are drawn, below the wall.
    const below = lines.slice(wall + 1).join('\n')
    expect(below).toContain('done')
    expect(below).toContain('fail')

    // Nothing leaves through the stand-in node's own side: no `├─` port on
    // a row inside the cluster.
    const inside = lines.slice(0, wall)
    expect(inside.some((l) => /├─+┼/.test(l))).toBe(false)

    // The wall is crossed once, by the shared trunk.
    expect(lines[wall]!.match(/┼/g)).toHaveLength(1)

    // Both edges still arrive: two arrowheads above the two targets.
    const targetsRow = lines.findIndex((l) => /Done/.test(l) && /Error/.test(l))
    expect(targetsRow).toBeGreaterThan(-1)
    const arrowRow = lines
      .slice(wall + 1, targetsRow)
      .find((l) => (l.match(/▼/g) ?? []).length === 2)
    expect(arrowRow).toBeDefined()
  })

  it('shares one trunk: the fan-out forks at a tee directly on the trunk column', () => {
    // Unlabeled, so no label sits on the fork itself.
    const lines = render(
      FLOW_TWIN.replace('-->|done|', '-->').replace('-->|fail|', '-->'),
    )
    const wall = wallRow(lines)
    const trunkCol = lines[wall]!.indexOf('┼')
    // The row below the wall forks at the trunk column (a tee) and runs to
    // the other target's column.
    const fork = lines[wall + 1]!
    expect(fork[trunkCol]).toBe('├')
    expect(fork).toMatch(/├─+┐/)
  })

  it('LR mirror: both exits leave through the right wall', () => {
    const lines = render(`flowchart LR
  Processing
  subgraph Processing
    N
  end
  Processing -->|done| Done
  Processing -->|fail| Error
`)
    // The right wall is the last `│` column of the cluster box; the stub
    // crosses it once, as a `┼` on N's row.
    const nRow = lines.findIndex((l) => /│ N /.test(l))
    expect(nRow).toBeGreaterThan(-1)
    expect(lines[nRow]).toMatch(/N ├─+┼/)
    // Labels sit outside the wall: `fail` must not start at or before it.
    const wallCol = lines[nRow]!.indexOf('┼')
    const failRow = lines.find((l) => l.includes('fail'))!
    expect(failRow.indexOf('fail')).toBeGreaterThan(wallCol)
    // Both targets are reached.
    expect(lines.join('\n')).toMatch(/►│\s+Done/)
    expect(lines.join('\n')).toMatch(/►│\s+Error/)
  })
})

describe('cluster-exit anchoring: engagement and fallbacks', () => {
  it('engages for 2+ exits and records a plan on the graph', () => {
    const graph = layout(FLOW_TWIN)
    expect(graph.clusterExitPlans?.size).toBe(1)
    const [plan] = [...graph.clusterExitPlans!.values()]
    expect(plan!.edges.size).toBe(2)
  })

  it('single-exit cluster: untouched, byte-identical to the pre-#1148 render', () => {
    const src = `flowchart TD
  subgraph S
    a
  end
  S --> C
  a --> D
`
    // `S --> C` is the cluster's only subgraph-addressed exit; `a --> D` is
    // an ordinary edge from the member node itself.
    expect(layout(src).clusterExitPlans).toBeUndefined()
    expect(render(src).join('\n')).toBe(
      [
        '┌───────┐',
        '│   S   │',
        '│       │',
        '│       │',
        '│ ┌───┐ │',
        '│ │   │ │',
        '│ │ a ├─┼─────┐',
        '│ │   │ │     │',
        '│ └─┬─┘ │     │',
        '│   │   │     │',
        '└───┼───┘     │',
        '    │         │',
        '    │         │',
        '    ▼         ▼',
        '  ┌───┐     ┌───┐',
        '  │   │     │   │',
        '  │ C │     │ D │',
        '  │   │     │   │',
        '  └───┘     └───┘',
        '',
        '',
        '',
      ]
        .join('\n')
        .trimEnd(),
    )
  })

  it('a graph with no subgraph-addressed edges never builds a plan', () => {
    expect(
      layout('flowchart TD\n  A --> B\n  A --> C\n').clusterExitPlans,
    ).toBe(undefined)
  })

  it('backward target: one forward + one backward exit does not engage', () => {
    const graph = layout(`flowchart TD
  U --> S
  subgraph S
    a
  end
  S --> C
  S --> U
`)
    expect(graph.clusterExitPlans).toBeUndefined()
  })

  it('parallel-lane siblings keep lane routing (only one eligible edge remains)', () => {
    const graph = layout(`flowchart TD
  subgraph S
    a
  end
  S -->|x| C
  S -->|y| C
  S --> D
`)
    expect(graph.clusterExitPlans).toBeUndefined()
    const lanes = graph.edges.filter((e) => e.parallelLane)
    expect(lanes).toHaveLength(2)
  })

  it('empty cluster: edges from it are dropped as before, without error', () => {
    const graph = layout(`flowchart TD
  subgraph S
  end
  S --> C
  S --> D
`)
    expect(graph.clusterExitPlans).toBeUndefined()
    expect(() =>
      render(`flowchart TD
  subgraph S
  end
  S --> C
  S --> D
`),
    ).not.toThrow()
  })

  it('a direct edge from the member node is not cluster-addressed', () => {
    const graph = layout(`flowchart TD
  subgraph S
    a
  end
  a --> C
  a --> D
`)
    expect(graph.edges.every((e) => e.clusterSource === undefined)).toBe(true)
    expect(graph.clusterExitPlans).toBeUndefined()
  })
})

describe('cluster-exit anchoring: overlapping root subgraphs (#1165)', () => {
  // S1's long title widens its box on both sides until it collides with its
  // neighbour S2, which is exactly what ensureSubgraphSpacing resolves.
  const src = `flowchart TD
  subgraph S1["Long cluster title"]
    a
  end
  subgraph S2
    b
  end
  X --> a
  X --> b
  S1 -->|one| C
  S1 -->|two| D
`

  it('the fixture makes ensureSubgraphSpacing fire, and exits still cross the wall', () => {
    const graph = layout(src)
    const s1 = graph.subgraphs.find((sg) => sg.name === 'Long cluster title')!
    const s2 = graph.subgraphs.find((sg) => sg.name === 'S2')!
    // Without the pass, S1's widened box would start at or before S2's right
    // wall. Its post-pass left wall is exactly maxX + minSpacing + 1.
    const widenedMinX =
      Math.min(...s1.nodes.map((n) => n.drawingCoord!.x)) - 2 - 6
    expect(widenedMinX).toBeLessThanOrEqual(s2.maxX + 1)
    expect(s1.minX).toBe(s2.maxX + 2)

    expect(graph.clusterExitPlans?.size).toBe(1)
    const lines = render(src)
    const text = lines.join('\n')
    // S1's bottom wall is crossed by the trunk, and both targets are reached.
    expect(text).toMatch(/└─+┼─+┘/)
    expect((text.match(/▼/g) ?? []).length).toBeGreaterThanOrEqual(3)
    expect(text).toContain('one')
    expect(text).toContain('two')
  })
})

describe('cluster-exit anchoring: gutter sizing', () => {
  const src = `flowchart TD
  subgraph S
    a
  end
  S -->|one| C
  S -->|two| D
`

  it.each([2, 3, 5, 8])(
    'paddingY %i: the trunk crosses the wall and labels stay below it',
    (paddingY) => {
      const lines = render(src, { paddingY, paddingX: paddingY })
      const wall = wallRow(lines)
      expect(wall).toBeGreaterThan(-1)
      expect(lines[wall]).not.toMatch(/one|two/)
      expect(lines[wall]!.match(/┼/g)).toHaveLength(1)
      expect(lines.slice(wall + 1).join('\n')).toContain('one')
      expect(lines.slice(wall + 1).join('\n')).toContain('two')
    },
  )

  it('nested cluster sharing the bottom edge (2 boxes): still clears both walls', () => {
    const lines = render(
      `flowchart TD
  subgraph Outer
    subgraph Inner
      x
    end
  end
  Outer -->|one| C
  Outer -->|two| D
`,
      { paddingY: 2, paddingX: 2 },
    )
    // Two nested bottom walls, each crossed by the trunk.
    const walls = lines
      .map((l, i) => [l, i] as const)
      .filter(([l]) => /└─+┼─+┘/.test(l))
    expect(walls.length).toBeGreaterThanOrEqual(2)
    const outerWall = Math.max(...walls.map(([, i]) => i))
    expect(lines[outerWall]).not.toMatch(/one|two/)
    expect(lines.slice(outerWall + 1).join('\n')).toContain('one')
    expect(lines.slice(outerWall + 1).join('\n')).toContain('two')
  })

  it('LR with a long cluster label: the gutter clears the label-widened wall', () => {
    const lines = render(`flowchart LR
  subgraph AVeryLongClusterLabelName
    N
  end
  AVeryLongClusterLabelName -->|done| Done
  AVeryLongClusterLabelName -->|fail| Error
`)
    const text = lines.join('\n')
    // The cluster box is drawn intact: its top wall's closing corner exists,
    // and the label `done` is not adjacent to a wall glyph on its left.
    expect(text).toMatch(/┐/)
    const doneRow = lines.find((l) => l.includes('done'))!
    expect(doneRow).toMatch(/┼[─┬]*done─*►/)
  })
})

describe('cluster-exit anchoring: style-conflict reroute keeps the cluster shape', () => {
  it('a dotted exit alongside a solid one still forks from the shared trunk', () => {
    const src = `flowchart TD
  subgraph S
    a
  end
  S --> C
  S -.-> D
`
    const lines = render(src)
    const wall = wallRow(lines)
    expect(wall).toBeGreaterThan(-1)
    expect(lines.slice(0, wall).some((l) => /├─+┼/.test(l))).toBe(false)
    // The dotted leg forks off the trunk on the gutter row and reaches D.
    expect(lines[wall + 1]).toMatch(/├┄+┐/)
    expect(lines.join('\n')).toMatch(/▼[\s\S]*▼/)
  })
})

describe('cluster-exit anchoring: chain partner leaving the target', () => {
  it("a later edge out of the target doesn't retrace the cluster exit's last leg", () => {
    const lines = render(`stateDiagram-v2
  [*] --> Idle
  Idle --> Processing : submit
  state Processing {
    parse --> validate
    validate --> execute
  }
  Processing --> Complete : done
  Processing --> Error : fail
  Error --> Idle : retry
  Complete --> [*]`)
    // `fail` arrives at Error's top face. Were `retry` routed out of the same
    // face, its line would merge into the arrow above Error and turn its top
    // border into a `┴` junction; it must leave through Error's right side.
    const top = lines.findIndex((l) => /╭─+╮\s+╭─+╮/.test(l))
    expect(top).toBeGreaterThan(-1)
    expect(lines[top]).not.toMatch(/┴/)
    expect(lines.find((l) => l.includes('Error'))).toMatch(/Error ├/)
  })
})

describe('cluster-exit anchoring: BT and ASCII modes', () => {
  it('BT flips the finished layout: exits leave through the (now top) wall', () => {
    const lines = render(FLOW_TWIN.replace('flowchart TD', 'flowchart BT'))
    const text = lines.join('\n')
    expect(text).toContain('done')
    expect(text).toContain('fail')
    expect((text.match(/▲/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('ASCII mode renders both exits with labels and arrowheads', () => {
    const text = render(FLOW_TWIN, { useAscii: true }).join('\n')
    expect(text).toContain('done')
    expect(text).toContain('fail')
    expect((text.match(/v/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })
})
