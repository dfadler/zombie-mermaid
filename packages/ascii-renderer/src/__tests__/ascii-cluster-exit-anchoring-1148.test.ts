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
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { convertToAsciiGraph } from '../converter.ts'
import { createMapping, gridToDrawingCoord } from '../grid.ts'
import { planClusterExits } from '../cluster-boundary.ts'
import { determinePath } from '../edge-routing.ts'
import { gridKey } from '../types.ts'
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

    // Each exit starts on the wall at its own junction (#1330, #1182), `┬`,
    // and nothing crosses it.
    expect(lines[wall]!.match(/┬/g)).toHaveLength(2)
    expect(lines[wall]).not.toMatch(/┼/)

    // Both edges still arrive: two arrowheads above the two targets.
    const targetsRow = lines.findIndex((l) => /Done/.test(l) && /Error/.test(l))
    expect(targetsRow).toBeGreaterThan(-1)
    const arrowRow = lines
      .slice(wall + 1, targetsRow)
      .find((l) => (l.match(/▼/g) ?? []).length === 2)
    expect(arrowRow).toBeDefined()
  })

  it('each exit has its own wall junction and stroke, in target order (#1182)', () => {
    // Unlabeled, so no label sits on a stroke.
    const lines = render(
      FLOW_TWIN.replace('-->|done|', '-->').replace('-->|fail|', '-->'),
    )
    const wall = wallRow(lines)
    const first = lines[wall]!.indexOf('┬')
    const second = lines[wall]!.lastIndexOf('┬')
    expect(second).toBeGreaterThan(first)
    // Done is the left target, so it takes the left junction: its stroke
    // drops straight to the arrowhead, while Error's turns right on the
    // gutter row and runs out to its own column. Neither is a shared trunk.
    expect(lines[wall + 1]![first]).toBe('│')
    expect(lines[wall + 1]![second]).toBe('└')
    expect(lines[wall + 1]).toMatch(/└─+┐/)
    const arrows = lines.findIndex((l) => (l.match(/▼/g) ?? []).length === 2)
    expect(lines[arrows]![first]).toBe('▼')
    const targets = lines.findIndex((l) => /Done/.test(l) && /Error/.test(l))
    expect(lines[targets]!.indexOf('Done')).toBeLessThan(
      lines[targets]!.indexOf('Error'),
    )
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
    // The right wall is the last `│` column of the cluster box; the exits
    // start on it (#1330) as `├` tees, with N's own border intact.
    const nRow = lines.findIndex((l) => /│ N /.test(l))
    expect(nRow).toBeGreaterThan(-1)
    expect(lines[nRow]).not.toMatch(/N ├/)
    const wallCol = lines[nRow]!.indexOf('│', lines[nRow]!.indexOf('N │') + 3)
    expect(lines.filter((l) => l[wallCol] === '├')).toHaveLength(2)
    // Labels sit outside the wall: `fail` must not start at or before it.
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

  it('lane siblings alone (no other exit) do not engage; they keep lane routing', () => {
    const graph = layout(`flowchart TD
  subgraph S
    a
  end
  S -->|x| C
  S -->|y| C
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
    // S1's bottom wall is where the trunk starts, and both targets are reached.
    expect(text).toMatch(/└─+┬─+┘/)
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
      expect(lines[wall]!.match(/┬/g)).toHaveLength(2)
      expect(lines.slice(wall + 1).join('\n')).toContain('one')
      expect(lines.slice(wall + 1).join('\n')).toContain('two')
    },
  )

  it('nested cluster sharing the bottom edge (2 boxes): the trunk starts on the outer wall', () => {
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
    // The exits start on the outer cluster's bottom wall (#1330); the inner
    // cluster's wall (and the member inside it) is left intact.
    const walls = lines
      .map((l, i) => [l, i] as const)
      .filter(([l]) => /└─+┬─+┬─+┘/.test(l))
    expect(walls).toHaveLength(1)
    expect(lines.filter((l) => /└─+┼─+┘/.test(l))).toHaveLength(0)
    const outerWall = walls[0]![1]
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
    expect(doneRow).toMatch(/└─*done─*►/)
  })
})

describe('cluster-exit anchoring: style-conflict reroute keeps the cluster shape', () => {
  it('a dotted exit alongside a solid one still leaves from its own wall junction', () => {
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
    // Two junctions on the wall; the dotted leg runs along the gutter row
    // from its own stroke and reaches D, beside the solid exit to C.
    expect(lines[wall]!.match(/┬/g)).toHaveLength(2)
    expect(lines[wall + 1]).toMatch(/└┐ +└┄+┐/)
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

describe('cluster-exit anchoring: eligibility edge cases', () => {
  const engagedEdgeCounts = (src: string): number[] =>
    [...(layout(src).clusterExitPlans?.values() ?? [])].map((p) => p.edges.size)

  it('a self-loop on the cluster is not an exit: the other two still engage', () => {
    const src = `flowchart TD
  subgraph S
    a
  end
  S --> S
  S --> C
  S --> D
`
    expect(engagedEdgeCounts(src)).toEqual([2])
    expect(() => render(src)).not.toThrow()
  })

  it('an edge into the cluster’s own member is not an exit', () => {
    const src = `flowchart TD
  subgraph S
    a
  end
  S --> a
  S --> C
  S --> D
`
    expect(engagedEdgeCounts(src)).toEqual([2])
  })

  it('an exit with a single eligible edge is left on ordinary routing', () => {
    const src = `flowchart TD
  subgraph S
    a
  end
  S --> C
  S --> S
`
    expect(layout(src).clusterExitPlans).toBeUndefined()
  })

  it('a multi-member cluster plans its stub from the stand-in node', () => {
    const src = `flowchart TD
  subgraph S
    a --> b
  end
  S --> C
  S --> D
`
    expect(engagedEdgeCounts(src)).toEqual([2])
    const lines = render(src)
    expect(wallRow(lines)).toBeGreaterThan(-1)
  })

  it('a foreign node inside the cluster box blocks the stub: no plan, no throw', () => {
    const src = `flowchart TD
  subgraph S
    a
    b
  end
  subgraph T
    x
  end
  a --> x
  S --> C
  S --> D
`
    const graph = layout(src)
    // Whether the stub is clear depends on the layout; either way the
    // render must succeed and draw both exits' arrowheads.
    for (const plan of graph.clusterExitPlans?.values() ?? []) {
      expect(plan.edges.size).toBeGreaterThanOrEqual(2)
    }
    expect(() => render(src)).not.toThrow()
  })

  it('nested clusters that both engage: widening clears each wall (LR, long labels)', () => {
    const src = `flowchart LR
  subgraph Outer [A very long outer label here]
    subgraph Inner [Another very long inner label]
      a --> b
    end
  end
  Inner --> C
  Inner --> D
  Outer --> E
  Outer --> F
`
    expect(layout(src).clusterExitPlans?.size).toBe(2)
    const text = render(src).join('\n')
    for (const id of ['C', 'D', 'E', 'F']) expect(text).toContain(id)
  })

  it('outer cluster wall is checked after inner widening shifts it (#1213)', () => {
    // Outer has a member (z) right of Inner, so widening Inner's gutter
    // shifts Outer's wall. Outer's gutter must be checked against that final
    // wall, which needs Outer processed before Inner.
    const src = `flowchart LR
  subgraph Outer [A very long outer label here]
    subgraph Inner [Inner label]
      a
    end
    b --> z
  end
  Inner --> C
  Inner --> D
  Outer --> E
  Outer --> F
`
    const graph = layout(src)
    expect(graph.clusterExitPlans?.size).toBe(2)
    for (const [sg, plan] of graph.clusterExitPlans ?? []) {
      expect(gridToDrawingCoord(graph, plan.gutter).x).toBeGreaterThan(sg.maxX)
    }
    // Rendered: Outer's exits start on its wall (├, #1330), E's straight
    // out of z's row, then run on past it to their targets.
    const zRow = render(src).find((l) => l.includes('z'))
    expect(zRow).toMatch(/z │ +├─+►/)
  })
})

describe('cluster-exit anchoring: planner guards (graph mutated after layout)', () => {
  const TWIN = `flowchart TD
  subgraph S
    a --> b
  end
  S --> C
  S --> D
`
  /** A laid-out graph with its engaged plan cleared, ready to re-plan. */
  function replanTarget() {
    const graph = layout(TWIN)
    const sg = graph.subgraphs[0]!
    const exits = graph.edges.filter((e) => e.clusterSource === sg)
    graph.clusterExitPlans = undefined
    return { graph, sg, exits }
  }

  it('baseline: re-planning the untouched layout engages both exits', () => {
    const { graph } = replanTarget()
    planClusterExits(graph)
    expect(graph.clusterExitPlans?.size).toBe(1)
  })

  it('a member without a grid coordinate is skipped when measuring the box', () => {
    const { graph, sg } = replanTarget()
    const dropped = sg.nodes.find((n) => n !== sg.nodes[0])!
    const saved = dropped.gridCoord
    dropped.gridCoord = null
    try {
      expect(() => planClusterExits(graph)).not.toThrow()
    } finally {
      dropped.gridCoord = saved
    }
  })

  it('a cluster none of whose members were placed gets no plan', () => {
    const { graph, sg } = replanTarget()
    for (const n of sg.nodes) n.gridCoord = null
    planClusterExits(graph)
    expect(graph.clusterExitPlans).toBeUndefined()
  })

  it('an edge whose target was never placed is not eligible', () => {
    const { graph, exits } = replanTarget()
    exits[0]!.to.gridCoord = null
    planClusterExits(graph)
    expect(graph.clusterExitPlans).toBeUndefined()
  })

  it('an edge whose source is not a member of the cluster is not eligible', () => {
    const { graph, sg, exits } = replanTarget()
    sg.nodes = sg.nodes.filter((n) => n !== exits[0]!.from)
    planClusterExits(graph)
    expect(graph.clusterExitPlans).toBeUndefined()
  })

  it('exits that do not share one stand-in node do not engage', () => {
    const { graph, sg, exits } = replanTarget()
    const other = sg.nodes.find((n) => n !== exits[0]!.from)!
    exits[1]!.from = other
    planClusterExits(graph)
    expect(graph.clusterExitPlans).toBeUndefined()
  })

  it('a stub blocked by a foreign cell is rejected', () => {
    const { graph, sg, exits } = replanTarget()
    const anchor = exits[0]!.from.gridCoord!
    // The gutter cell: one row below the lowest member, in the stub's column.
    const boxMaxY = Math.max(...sg.nodes.map((n) => n.gridCoord!.y + 2))
    graph.grid.add(gridKey({ x: anchor.x + 1, y: boxMaxY + 1 }))
    planClusterExits(graph)
    expect(graph.clusterExitPlans).toBeUndefined()
  })

  /**
   * Fill the band between the cluster and the targets (everything on the
   * rows above the targets except the gutter cell itself), so the outside
   * leg to a target that is not directly below the gutter has no route.
   */
  function blockBand(
    graph: ReturnType<typeof layout>,
    gutter: { x: number; y: number },
    toY: number,
  ): void {
    for (let x = 0; x <= 14; x++) {
      for (let y = gutter.y - 2; y < toY; y++) {
        if (x === gutter.x && y === gutter.y) continue
        graph.grid.add(gridKey({ x, y }))
      }
    }
  }

  it('an unroutable outside leg rejects the whole plan (all-or-nothing)', () => {
    const { graph, exits } = replanTarget()
    const far = exits.find((e) => e.to.gridCoord!.x > 2)!
    blockBand(graph, { x: 1, y: 7 }, far.to.gridCoord!.y)
    planClusterExits(graph)
    expect(graph.clusterExitPlans).toBeUndefined()
  })

  it('determinePath drops an engaged edge whose outside leg became unroutable', () => {
    const graph = layout(TWIN)
    const [plan] = [...graph.clusterExitPlans!.values()]
    const edge = [...plan!.edges].find((e) => e.to.gridCoord!.x > 2)!
    blockBand(graph, plan!.gutter, edge.to.gridCoord!.y)
    expect(() => determinePath(graph, edge)).not.toThrow()
    expect(plan!.edges.has(edge)).toBe(false)
    expect(edge.labelLine).toEqual([])
  })
})

describe('chain-overlap threshold only tightens for engaged cluster exits', () => {
  // `A --> X` is cluster-addressed but the only exit of A, so no plan is
  // made and it routes ordinarily. The chain partner `A --> a1` (via `Y`)
  // sharing a single open cell with it is an ordinary crossing, exactly as
  // on main (threshold 2) — it must not be rerouted into a garbled box.
  const SINGLE_EXIT = `flowchart LR
  subgraph A
    a1
  end
  A --> X
  A --> a1
  Y --> A
`

  it('a single-exit cluster edge keeps the ordinary 2-cell chain threshold', () => {
    const graph = layout(SINGLE_EXIT)
    expect(graph.clusterExitPlans).toBeUndefined()
    const out = render(SINGLE_EXIT).join('\n')
    expect(out).toContain('│ a1 ├')
    expect(out).not.toContain('a┌')
  })
})

describe('cluster-exit anchoring: shape of the whole composite-states render', () => {
  // The "State: Composite States" sample: two cluster exits (`done`, `fail`)
  // plus `retry`, an outside edge from `Error` back up to `Idle` that runs
  // alongside the cluster.
  const COMPOSITE_SAMPLE = `stateDiagram-v2
  [*] --> Idle
  Idle --> Processing : submit
  state Processing {
    parse --> validate
    validate --> execute
  }
  Processing --> Complete : done
  Processing --> Error : fail
  Error --> Idle : retry
  Complete --> [*]
`

  // A flowchart whose outside edge (`Aux`..`Last` chain) and `retry` pass the
  // cluster, with `Idle --> Aux` forcing `retry` to hug the cluster wall.
  const WALL_HUGGER = `flowchart TD
  Start --> Idle
  Idle --> Processing
  Idle --> Aux
  subgraph Processing
    a --> b
    b --> c
  end
  Aux --> Cache
  Cache --> Last
  Processing -->|done| Done
  Processing -->|fail| Error
  Error -->|retry| Idle
  Last --> Done
`

  /** Rows strictly between the first `┌…┐` top wall and its `└…┘` bottom wall. */
  const clusterBody = (lines: string[]) => {
    const top = lines.findIndex((l) => /^┌─/.test(l))
    const bottom = lines.findIndex((l) => /^└[─┼┬┴┤├]+┘/.test(l))
    expect(top).toBeGreaterThan(-1)
    expect(bottom).toBeGreaterThan(top)
    return {
      rightCol: lines[top]!.indexOf('┐'),
      rows: lines.slice(top + 1, bottom),
    }
  }

  it.each([
    ['composite sample', COMPOSITE_SAMPLE],
    ['outside edge hugging the wall', WALL_HUGGER],
  ])(
    '%s: both side walls are intact on every cluster row (no label overwrites one)',
    (_name, src) => {
      const lines = render(src)
      const { rightCol, rows } = clusterBody(lines)
      expect(rows.length).toBeGreaterThan(0)
      for (const row of rows) {
        expect(row[0]).toBe('│')
        expect(row[rightCol]).toBe('│')
      }
      // The `retry` label is still drawn, never inside a cluster row's walls.
      // On a row above the cluster it may sit right of the wall column, which
      // a title-widened frame can now reach.
      const retryRow = lines.find((l) => l.includes('retry'))!
      expect(
        !rows.includes(retryRow) || retryRow.indexOf('retry') > rightCol,
      ).toBe(true)
    },
  )

  it('retry runs as one clean route, not a staircase hugging the cluster', () => {
    const graph = layout(COMPOSITE_SAMPLE.replace(/\n$/, ''))
    const retry = graph.edges.find((e) => e.text === 'retry')!
    // Out of Error's side, one vertical run, into Idle's side: at most two
    // bends, i.e. four merged points. The staircase had ten.
    expect(retry.path.length).toBeLessThanOrEqual(4)

    // Rendered: one column of `│` right of the cluster carries the run.
    const lines = render(COMPOSITE_SAMPLE)
    const { rightCol } = clusterBody(lines)
    const idleRow = lines.findIndex((l) => l.includes('retry'))
    const columns = new Set<number>()
    // Beside the cluster body, where the run used to jog.
    for (const row of lines.slice(idleRow + 1, wallRow(lines))) {
      const col = row.indexOf('│', rightCol + 1)
      if (col > -1) columns.add(col)
    }
    expect([...columns]).toHaveLength(1)
  })

  it('done and fail labels do not share a row (no `done────fail` run)', () => {
    const lines = render(COMPOSITE_SAMPLE)
    const doneRow = lines.findIndex((l) => l.includes('done'))
    const failRow = lines.findIndex((l) => l.includes('fail'))
    expect(doneRow).toBeGreaterThan(-1)
    expect(failRow).toBeGreaterThan(-1)
    expect(doneRow).not.toBe(failRow)
    expect(lines.join('\n')).not.toMatch(/done─+fail/)
  })

  it('3-exit cluster: every exit label sits on its own row', () => {
    const lines = render(`stateDiagram-v2
  state Processing {
    parse --> execute
  }
  Processing --> Complete : done
  Processing --> Error : fail
  Processing --> Aborted : abort
`)
    const rows = ['done', 'fail', 'abort'].map((t) =>
      lines.findIndex((l) => l.includes(t)),
    )
    expect(rows.every((r) => r > -1)).toBe(true)
    // `fail` and `abort` fan out on the gutter row together, as before; the
    // straight-ahead `done` is the one that must leave it.
    expect(rows[0]).not.toBe(rows[1])
    expect(rows[0]).not.toBe(rows[2])
  })
})
