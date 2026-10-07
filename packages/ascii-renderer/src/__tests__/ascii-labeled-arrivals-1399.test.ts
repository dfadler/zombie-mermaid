/**
 * #1399: two labeled edges that reach one port of a node from opposite sides
 * (CI/CD's `Tests Pass? -->|No| Fix & Retry` and `QA Approved? -->|No| ...`)
 * each get their own column and arrowhead instead of merging into one.
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

const arrowheadsAbove = (out: string, label: string): number => {
  const rows = out.split('\n')
  const at = rows.findIndex((r) => r.includes(label))
  const col = rows[at]!.indexOf(label)
  // Only the box's own span: the row above also holds other columns' arrows.
  const span = (rows[at - 3] ?? '').slice(col - 2, col + label.length + 2)
  return [...span].filter((c) => c === '▼').length
}

describe('ASCII labeled arrivals from opposite sides (#1399)', () => {
  it('gives each labeled edge into Fix & Retry its own arrowhead', () => {
    const out = renderMermaidASCII(CI_CD, { colorMode: 'none' })
    expect(arrowheadsAbove(out, 'Fix & Retry')).toBe(2)
  })

  it('leaves unlabeled fan-in sharing one arrowhead', () => {
    const out = renderMermaidASCII(CI_CD.replaceAll('|No|', ''), {
      colorMode: 'none',
    })
    expect(arrowheadsAbove(out, 'Fix & Retry')).toBe(1)
  })

  it('keeps one trunk when only one of the two arrivals is labeled', () => {
    const out = renderMermaidASCII(CI_CD.replace('F -->|No| D', 'F --> D'), {
      colorMode: 'none',
    })
    expect(arrowheadsAbove(out, 'Fix & Retry')).toBe(1)
  })
})
