/**
 * A Z-shaped edge in a vertical flow bends where `AsciiEdgeHint.bend` says
 * (read from the real-size layout), which is the gap's middle row for these
 * four strokes, as in mermaid@12.3.0: rendering
 * this source (TD and BT) bends A->C, B->C, C->D and C->E at exactly 0.50 of
 * the gap, where the grid drew the fan-ins at 0.67 and the fan-outs at 0.33.
 */
import { describe, expect, it } from 'vitest'
import { readGrid } from '../scripts/lib/ascii-topology.ts'

const src = (dir: string): string => `flowchart ${dir}
  A[Input] & B[Config] --> C[Processor]
  C --> D[Output] & E[Log]`

describe('lone Z bend row (TD/BT)', () => {
  it.each(['TD', 'BT'])('%s: all four strokes bend mid-gap', (d) => {
    const { edges } = readGrid(src(d))
    for (const [from, to] of [
      ['A', 'C'],
      ['B', 'C'],
      ['C', 'D'],
      ['C', 'E'],
    ]) {
      const bend = edges.find((e) => e.from === from && e.to === to)?.bend
      expect(bend, `${from}->${to}`).toBeCloseTo(0.5, 1)
    }
  })
})
