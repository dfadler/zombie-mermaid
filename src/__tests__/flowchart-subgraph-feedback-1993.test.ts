/**
 * #1993: mermaid 12's ELK layout reverses the edge that closes a cycle
 * between a subgraph and the nodes around it (`orientFeedbackEdges`) before
 * breaking the remaining cycles depth-first. In the CI/CD sample that is
 * `F --> D` (out of the pipeline's box and back in), so `Fix & Retry` sits
 * beside `Build Image`, not below `QA Approved?`.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../index.ts'
import { layoutFlowchartSync } from '@zombie-mermaid/svg-renderer'
import { subgraphFeedbackEdges } from '@zombie-mermaid/core'

const CI_CD = `graph TD
  subgraph ci [CI Pipeline]
    A[Push Code] --> B{Tests Pass?}
    B -->|Yes| C[Build Image]
    B -->|No| D[Fix & Retry]
    D -.-> A
  end
  C --> E([Deploy Staging])
  E --> F{QA Approved?}
  F -->|Yes| G((Production))
  F -->|No| D`

const names = (src: string): string[] => {
  const g = parseMermaid(src)
  return [...subgraphFeedbackEdges(g)].map(
    (i) => `${g.edges[i]!.source}->${g.edges[i]!.target}`,
  )
}

describe('subgraphFeedbackEdges', () => {
  it('flags the edge that leaves a subgraph and comes back in', () => {
    expect(names(CI_CD)).toEqual(['F->D'])
  })

  it('flags nothing without subgraphs, or when no cycle crosses one', () => {
    expect(names('graph TD\n  A --> B\n  B --> A')).toEqual([])
    expect(
      names('graph TD\n  subgraph s\n    A --> B\n  end\n  B --> C\n  C --> D'),
    ).toEqual([])
  })

  it('leaves a cycle wholly inside a subgraph to the depth-first walk', () => {
    expect(
      names('graph TD\n  subgraph s\n    A --> B\n    B --> A\n  end'),
    ).toEqual([])
  })
})

describe('CI/CD sample layout', () => {
  it('puts Fix & Retry beside Build Image, in the same layer', () => {
    const p = layoutFlowchartSync(parseMermaid(CI_CD))
    const mid = (id: string): number => {
      const n = p.nodes.find((q) => q.id === id)!
      return n.y + n.height / 2
    }
    expect(Math.abs(mid('D') - mid('C'))).toBeLessThan(20)
  })
})
