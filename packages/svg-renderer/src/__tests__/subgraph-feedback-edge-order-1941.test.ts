import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../../../../src/index.ts'
import { layoutFlowchartSync } from '../index.ts'

// `C --> A` closes a cycle through the subgraph, so it is laid out reversed
// (A to C) and spans `B`. mermaid 12.1.0 and 12.2.0 keep that edge's track
// above `B`, which puts `B` below `A`, `C` and `D`; ours had it below (#1941).
const source = `flowchart LR
  subgraph S
    A[user] -->|req| B[login]
  end
  B -->|ok| C{decide}
  C -->|yes| D[done]
  C -->|no| A`

describe('subgraph feedback edge order (#1941)', () => {
  it('places B below A, C and D, as mermaid does', () => {
    const nodes = new Map(
      layoutFlowchartSync(parseMermaid(source)).nodes.map((n) => [n.id, n]),
    )
    const mid = (id: string): number =>
      nodes.get(id)!.y + nodes.get(id)!.height / 2
    for (const other of ['A', 'C', 'D']) {
      expect(mid('B')).toBeGreaterThan(mid(other) + 10)
    }
  })
})
