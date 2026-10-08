/**
 * #1399: a back edge between two nodes of the same subgraph is drawn inside
 * that frame. Its loop lane used to sit in the gap past the outermost node,
 * which the frame's wall cut through, so the dashed edge ran outside the frame
 * and crossed the wall.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

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

describe('ASCII intra-cluster back edge (#1399)', () => {
  it('keeps the dashed D --> A loop left of the frame wall', () => {
    const lines = renderMermaidASCII(CI_CD, { colorMode: 'none' }).split('\n')
    const wall = lines[0]!.indexOf('┐')
    const dashed = lines.flatMap((l) =>
      l.includes('┆') ? [l.indexOf('┆')] : [],
    )
    expect(dashed.length).toBeGreaterThan(0)
    for (const x of dashed) expect(x).toBeLessThan(wall)
    // The arrowhead into Push Code is also inside the frame.
    const arrow = lines.find((l) => l.includes('Push Code'))!
    expect(arrow.lastIndexOf('┐')).toBeLessThan(wall)
  })
})
