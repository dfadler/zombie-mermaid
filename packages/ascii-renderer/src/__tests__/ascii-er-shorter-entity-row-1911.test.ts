// ============================================================================
// ASCII ER diagram: a relationship beside a shorter entity stays inside both
// boxes (issue #1911)
//
// The horizontal relationship row was the left entity's vertical midpoint.
// When the right entity was shorter, that row landed on its bottom border, so
// the cardinality marker ran into the corner and the line was not attached to
// the box body. The row is now clamped into the rows both boxes share.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const SOURCE = `erDiagram
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER {
        int id PK
        string name
        string email
        string phone
        string address
    }
    ORDER {
        int id PK
    }`

describe('ASCII ER relationship beside a shorter entity (issue #1911)', () => {
  it('draws the relationship row inside the shorter entity, not on its border', () => {
    const lines = renderMermaidASCII(SOURCE).split('\n')
    const marker = lines.find((l) => l.includes('╟'))
    expect(marker).toBeDefined()
    // The crow's-foot marker sits flush against the shorter box's left side
    // (a ├ junction), never against its bottom-left corner.
    expect(marker).toContain('╟├')
    expect(marker).not.toContain('╟└')
  })

  it('keeps the relationship label between the two boxes', () => {
    const lines = renderMermaidASCII(SOURCE).split('\n')
    const label = lines.find((l) => l.includes('places'))
    expect(label).toBeDefined()
    expect(label!.indexOf('places')).toBeGreaterThan(label!.indexOf('│') + 1)
    expect(label!.indexOf('places')).toBeLessThan(label!.lastIndexOf('│'))
  })

  it('uses the same row in ASCII-only mode', () => {
    const lines = renderMermaidASCII(SOURCE, { useAscii: true }).split('\n')
    const marker = lines.find((l) => l.includes('o<'))
    expect(marker).toBeDefined()
    // 'o<' is the zero-or-many marker; it must end on a '+' junction followed
    // by a border run, with the shorter box's bottom border on a later row.
    expect(marker).toMatch(/o<\+-+\+/)
    const markerRow = lines.indexOf(marker!)
    const bottom = lines.findIndex(
      (l, i) => i > markerRow && l.includes('+-----------+'),
    )
    expect(bottom).toBeGreaterThan(markerRow)
  })
})
