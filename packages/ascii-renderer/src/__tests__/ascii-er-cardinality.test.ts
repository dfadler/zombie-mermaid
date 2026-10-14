// ============================================================================
// ASCII ER diagram crow's-foot cardinality marker tests
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

describe('ASCII ER crow-foot cardinality markers', () => {
  it('mirrors the zero-one marker orientation on the left side (regression)', () => {
    // Left-side markers sit at the left entity's right edge, pointing away
    // from it (line nearest the entity, circle furthest): "|o". Before the
    // fix, getCrowsFootChars() always returned "o|" regardless of side,
    // which is only correct on the right side.
    const ascii = renderMermaidASCII(
      `erDiagram
        direction LR
        WIDGET |o--|| GADGET : rel`,
      { useAscii: true },
    )
    expect(ascii).toContain('|o')

    const unicode = renderMermaidASCII(`erDiagram
      direction LR
      WIDGET |o--|| GADGET : rel`)
    expect(unicode).toContain('│○')
  })

  it('keeps the zero-one marker orientation on the right side', () => {
    // Right-side markers sit at the right entity's left edge, pointing away
    // from it: circle nearest the entity, line furthest: "o|".
    const ascii = renderMermaidASCII(
      `erDiagram
        direction LR
        WIDGET ||--o| GADGET : rel`,
      { useAscii: true },
    )
    expect(ascii).toContain('o|')

    const unicode = renderMermaidASCII(`erDiagram
      direction LR
      WIDGET ||--o| GADGET : rel`)
    expect(unicode).toContain('○│')
  })

  it('draws many / zero-many / zero-one along the vertical axis on a vertical edge (#2081)', () => {
    // Default ER layout stacks entities top to bottom, so these markers sit
    // on a vertical run: the upper entity's marker opens downward, the
    // lower one's upward, and neither reuses the horizontal ╟/╢ glyphs.
    const render = (src: string, useAscii = false) =>
      renderMermaidASCII(`erDiagram\n  ${src}`, { useAscii })

    const manyUni = render('A }|--o{ B : r')
    expect(manyUni).toContain('╤')
    expect(manyUni).toContain('○╧')
    expect(manyUni).not.toMatch(/[╟╢]/)

    const manyAscii = render('A }|--o{ B : r', true)
    expect(manyAscii).toMatch(/^\s*V\s*$/m)
    expect(manyAscii).toMatch(/^\s*o\^\s*$/m)

    expect(render('A ||--o| B : r')).toMatch(/^\s*○┼\s*$/m)
  })
})
