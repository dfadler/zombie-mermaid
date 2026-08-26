// ============================================================================
// ASCII ER diagram crow's-foot cardinality marker tests
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

describe('ASCII ER crow-foot cardinality markers', () => {
  it('mirrors the zero-one marker orientation on the left side (regression)', () => {
    // Left-side markers sit at the left entity's right edge, pointing away
    // from it (line nearest the entity, circle furthest): "|o". Before the
    // fix, getCrowsFootChars() always returned "o|" regardless of side,
    // which is only correct on the right side.
    const ascii = renderMermaidASCII(
      `erDiagram
        WIDGET |o--|| GADGET : rel`,
      { useAscii: true },
    )
    expect(ascii).toContain('|o')

    const unicode = renderMermaidASCII(`erDiagram
      WIDGET |o--|| GADGET : rel`)
    expect(unicode).toContain('│○')
  })

  it('keeps the zero-one marker orientation on the right side', () => {
    // Right-side markers sit at the right entity's left edge, pointing away
    // from it: circle nearest the entity, line furthest: "o|".
    const ascii = renderMermaidASCII(
      `erDiagram
        WIDGET ||--o| GADGET : rel`,
      { useAscii: true },
    )
    expect(ascii).toContain('o|')

    const unicode = renderMermaidASCII(`erDiagram
      WIDGET ||--o| GADGET : rel`)
    expect(unicode).toContain('○│')
  })
})
