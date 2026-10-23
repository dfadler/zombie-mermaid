import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../../../../src/index.ts'
import { layoutFlowchartSync } from '../index.ts'

// ELK's post-compaction slid a sink one layer past its siblings when the edges
// into it carried inline labels (#1750).
const source = `graph TD
  A{Is it raining?} -->|Yes| B{Have umbrella?}
  A -->|No| C([Go outside])
  B -->|Yes| D([Go with umbrella])
  B -->|No| E{Is it heavy?}
  E -->|Yes| F([Stay inside])
  E -->|No| G([Run for it])`

describe('labeled sink layer (#1750)', () => {
  it('keeps sinks in the same layer as their siblings', () => {
    const nodes = new Map(
      layoutFlowchartSync(parseMermaid(source)).nodes.map((n) => [n.id, n]),
    )
    const overlaps = (a: string, b: string): boolean => {
      const [p, q] = [nodes.get(a)!, nodes.get(b)!]
      return p.y < q.y + q.height && q.y < p.y + p.height
    }
    expect(overlaps('B', 'C')).toBe(true)
    expect(overlaps('E', 'D')).toBe(true)
  })
})
