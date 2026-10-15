/**
 * #2111: the ASCII grid ranks a subgraph feedback edge (mermaid 12's
 * `orientFeedbackEdges`, shared with the SVG layout through core's
 * `subgraphFeedbackEdges`) as if it ran target -> source. In CI/CD, `F -->|No| D`
 * leaves QA for `Fix & Retry` inside `ci`, so `Fix & Retry` sits beside
 * `Build Image` (checked on mermaid 12.1.0 and 12.2.0), not below QA.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { subgraphFeedbackEdges } from '@zombie-mermaid/core'
import { convertToAsciiGraph } from '../../packages/ascii-renderer/src/converter.ts'
import { createMapping } from '../../packages/ascii-renderer/src/grid.ts'
import { requireGridCoord } from '../../packages/ascii-renderer/src/types.ts'
import type { AsciiConfig } from '../../packages/ascii-renderer/src/types.ts'

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

const config: AsciiConfig = {
  useAscii: false,
  paddingX: 5,
  paddingY: 5,
  boxBorderPadding: 1,
  graphDirection: 'TD',
}

describe('ASCII subgraph feedback edge orientation (#2111)', () => {
  it('marks the same edge the SVG layout does', () => {
    const parsed = parseMermaid(CI_CD)
    const graph = convertToAsciiGraph(parsed, config)
    const marked = graph.edges.filter((e) => e.feedback)
    expect(marked.map((e) => `${e.from.name}>${e.to.name}`)).toEqual(['F>D'])
    expect(subgraphFeedbackEdges(parsed).size).toBe(1)
  })

  it('puts Fix & Retry in the same layer as Build Image', () => {
    const graph = convertToAsciiGraph(parseMermaid(CI_CD), config)
    createMapping(graph)
    const row = (name: string): number =>
      requireGridCoord(graph.nodes.find((n) => n.name === name)!).y
    expect(row('D')).toBe(row('C'))
    expect(row('F')).toBeGreaterThan(row('D'))
  })
})
