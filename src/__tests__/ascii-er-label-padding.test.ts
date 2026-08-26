// ============================================================================
// ASCII ER diagram relationship label truncation/padding regression tests
// (GitHub issue #67)
//
// Relationship labels were clamped to a fixed 6-char inter-entity gap,
// silently truncating anything longer (e.g. "ordered in" → "ordere") and,
// even when a label did fit, leaving it flush against both entity boxes
// with zero padding. The cardinality glyph cluster (e.g. "││───○╟") was
// also crammed directly against the entity box border.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

const REPRO = `erDiagram
  CUSTOMER ||--o{ ORDER : places
  PRODUCT ||--o{ LINE_ITEM : "ordered in"`

describe('ASCII ER relationship label truncation and padding (issue #67)', () => {
  it('renders a long quoted label in full instead of truncating it', () => {
    const ascii = renderMermaidASCII(REPRO, { colorMode: 'none' })

    expect(ascii).toContain('ordered in')
    // The old bug truncated to "ordere" — make sure that's gone.
    expect(ascii).not.toMatch(/ordere(?!d)/)
  })

  it('renders a long label in full in Unicode mode too', () => {
    const ascii = renderMermaidASCII(REPRO, {
      colorMode: 'none',
      useAscii: false,
    })
    expect(ascii).toContain('ordered in')
  })

  it('renders a long label in full in pure-ASCII mode too', () => {
    const ascii = renderMermaidASCII(REPRO, {
      colorMode: 'none',
      useAscii: true,
    })
    expect(ascii).toContain('ordered in')
  })

  it('keeps at least 1 char of padding between the label and each entity box', () => {
    const ascii = renderMermaidASCII(REPRO, { colorMode: 'none' })
    const lines = ascii.split('\n')

    // "places" sits on the row directly below the CUSTOMER/ORDER connector line,
    // between the two boxes' bottom borders. Find that row and confirm the
    // label isn't flush against either "└" border character.
    const placesLine = lines.find((l) => l.includes('places'))
    expect(placesLine).toBeDefined()
    const idx = placesLine!.indexOf('places')
    // Character immediately before/after the label must not be a box border.
    expect(placesLine![idx - 1]).not.toBe('┘')
    expect(placesLine![idx - 1]).not.toBe('└')
    expect(placesLine![idx + 'places'.length]).not.toBe('┌')
    expect(placesLine![idx + 'places'.length]).not.toBe('└')

    const orderedInLine = lines.find((l) => l.includes('ordered in'))
    expect(orderedInLine).toBeDefined()
    const idx2 = orderedInLine!.indexOf('ordered in')
    expect(orderedInLine![idx2 - 1]).not.toBe('┘')
    expect(orderedInLine![idx2 - 1]).not.toBe('└')
    expect(orderedInLine![idx2 + 'ordered in'.length]).not.toBe('┌')
    expect(orderedInLine![idx2 + 'ordered in'.length]).not.toBe('└')
  })

  it('keeps at least 1 char of padding between the cardinality glyph cluster and each entity box', () => {
    const ascii = renderMermaidASCII(
      `erDiagram
        CUSTOMER ||--o{ ORDER : places`,
      { colorMode: 'none' },
    )
    const lines = ascii.split('\n')
    // The connector line row contains the crow's foot markers, e.g.
    // "│ CUSTOMER │─│───○╟─│ ORDER │" — the marker must not sit directly
    // against the "│" that closes the CUSTOMER box or opens the ORDER box.
    const connectorLine = lines.find(
      (l) => l.includes('CUSTOMER') && (l.includes('│') || l.includes('|')),
    )
    expect(connectorLine).toBeDefined()

    // Locate the right border of the CUSTOMER box and left border of the ORDER box.
    const customerEnd = connectorLine!.indexOf('CUSTOMER') + 'CUSTOMER'.length
    const closingBorderIdx = connectorLine!.indexOf('│', customerEnd)
    expect(closingBorderIdx).toBeGreaterThan(-1)
    // The very next character must not itself be a cardinality marker glyph
    // touching the border — there must be at least 1 separating cell.
    const afterBorder = connectorLine![closingBorderIdx + 1]
    expect(afterBorder).not.toBe('○')
    expect(afterBorder).not.toBe('╟')
  })

  it('does not widen the gap for short labels that already fit (stays compact)', () => {
    const compact = renderMermaidASCII(
      `erDiagram
        A ||--o{ B : x`,
      { colorMode: 'none' },
    )
    // Sanity: still renders correctly and compactly (no huge gap for a 1-char label).
    const lines = compact.split('\n')
    const line = lines.find((l) => l.includes('A') && l.includes('│'))
    expect(line).toBeDefined()
    expect(line!.length).toBeLessThan(30)
    expect(compact).toContain('x')
  })

  it('full example diagram from the issue renders every entity and full labels', () => {
    const ascii = renderMermaidASCII(REPRO, { colorMode: 'none' })
    expect(ascii).toContain('CUSTOMER')
    expect(ascii).toContain('ORDER')
    expect(ascii).toContain('PRODUCT')
    expect(ascii).toContain('LINE_ITEM')
    expect(ascii).toContain('places')
    expect(ascii).toContain('ordered in')
  })
})
