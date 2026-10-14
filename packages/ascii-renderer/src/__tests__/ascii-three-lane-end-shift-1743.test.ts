/**
 * Plain (non-cluster) parallel lanes entering one target face (#1743): each
 * lane's arrowhead gets a row of its own, the outermost lane lowest so no
 * stroke crosses another. Since #2025 this is `allocateFaces`
 * (port-offsets.ts), which also gives each lane its own row on the source.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { convertToAsciiGraph } from '../converter.ts'
import { createMapping } from '../grid.ts'
import { portShifts } from '../port-offsets.ts'

const build = (lanes: number) => {
  // Long labels keep the lanes (short ones are drawn side by side instead).
  const edges = ['first', 'second', 'third', 'fourth', 'fifth']
    .slice(0, lanes)
    .map((label) => `  A -->|${label}| B`)
    .join('\n')
  const graph = convertToAsciiGraph(
    parseMermaid(`flowchart TD\n  Start --> A\n${edges}\n`),
    {
      useAscii: false,
      paddingX: 6,
      paddingY: 5,
      boxBorderPadding: 1,
      graphDirection: 'TD',
    },
  )
  createMapping(graph)
  const shifts = portShifts(graph)
  const later = graph.edges
    .filter((e) => e.parallelLane && e.parallelLane.index > 0)
    .sort((a, b) => a.parallelLane!.index - b.parallelLane!.index)
  return {
    ends: later.map((e) => shifts.get(e)?.end ?? 0),
    starts: later.map((e) => shifts.get(e)?.start ?? 0),
  }
}

describe('plain parallel lanes on the target face (#1743, #2025)', () => {
  it('three lanes: each later lane lands on its own row, the outer one lower', () => {
    const { ends, starts } = build(3)
    expect(ends[0]).toBeLessThan(ends[1]!)
    // Nested on the source too: the outer lane leaves higher.
    expect(starts[0]).toBeGreaterThan(starts[1]!)
  })

  it('four lanes take the face rows -1, 0, +1 (index 1 to 3)', () => {
    expect(build(4).ends).toEqual([-1, 0, 1])
  })
})
