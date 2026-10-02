/**
 * #1239: a flowchart whose subgraph feeds a top-level node declared after it
 * (`C --> E`) was laid out upside down: ELK treated the subgraph-to-leaf edge
 * as pointing against model order and reversed it, so the downstream node sat
 * above the subgraph that feeds it. mermaid.js draws it top to bottom.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../index.ts'
import { layoutGraphSync } from '@zombie-mermaid/svg-renderer'

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

function yOf(source: string): Record<string, number> {
  const y: Record<string, number> = {}
  for (const n of layoutGraphSync(parseMermaid(source)).nodes) y[n.id] = n.y
  return y
}

describe('flowchart flow direction with a subgraph (#1239)', () => {
  it('lays the CI/CD pipeline out top to bottom', () => {
    const y = yOf(CI_CD)
    // Main chain, in source order.
    expect(y.A!).toBeLessThan(y.B!)
    expect(y.B!).toBeLessThan(y.C!)
    expect(y.C!).toBeLessThan(y.E!)
    expect(y.E!).toBeLessThan(y.F!)
    expect(y.F!).toBeLessThan(y.G!)
  })

  it('keeps a downstream node below the subgraph that feeds it', () => {
    const y = yOf(`graph TD
  subgraph s [S]
    A --> B
  end
  B --> C`)
    expect(y.B!).toBeLessThan(y.C!)
  })

  it('keeps a top-level node above the subgraph it feeds', () => {
    const y = yOf(`graph TD
  X --> A
  subgraph s [S]
    A --> B
  end`)
    expect(y.X!).toBeLessThan(y.A!)
  })

  it('keeps left-to-right flow for LR graphs', () => {
    const x: Record<string, number> = {}
    const g = layoutGraphSync(
      parseMermaid(`graph LR
  subgraph s [S]
    A --> B
  end
  B --> C`),
    )
    for (const n of g.nodes) x[n.id] = n.x
    expect(x.A!).toBeLessThan(x.B!)
    expect(x.B!).toBeLessThan(x.C!)
  })
})
