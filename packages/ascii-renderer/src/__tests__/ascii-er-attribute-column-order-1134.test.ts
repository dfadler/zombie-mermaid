// ============================================================================
// ASCII ER diagram: attribute columns render as type/name/keys (issue #1134)
//
// formatAttribute (src/ascii/er-diagram.ts) used to build "PK type name" —
// keys, then type, then name — but real mermaid's SVG lays attribute
// columns out left-to-right as type/name/keys (confirmed against the SVG's
// attribute-type/attribute-name/attribute-keys x-coordinates in the
// form-judge report on issue #1119). This file pins the corrected order.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

/** The attribute rows of the first entity, one array of trimmed cells per row. */
const rows = (out: string): string[][] =>
  out
    .split('\n')
    .filter((l) => /^│.*│ *$/.test(l) && l.split('│').length > 3)
    .map((l) =>
      l
        .split('│')
        .slice(1, -1)
        .map((c) => c.trim()),
    )

describe('ASCII ER attribute columns render as type/name/keys (issue #1134)', () => {
  it('renders a single-key attribute as "type name KEY", not "KEY type name"', () => {
    const ascii = renderMermaidASCII(
      `erDiagram
        ORDER {
          int id PK
        }`,
      { colorMode: 'none' },
    )
    expect(rows(ascii)).toEqual([['int', 'id', 'PK']])
  })

  it('renders a multi-key attribute\'s keys joined and trailing, e.g. "type name PK,FK"', () => {
    const ascii = renderMermaidASCII(
      `erDiagram
        LINE_ITEM {
          int product_id PK, FK
        }`,
      { colorMode: 'none' },
    )
    expect(rows(ascii)).toEqual([['int', 'product_id', 'PK,FK']])
  })

  it('renders a keyless attribute with no reserved key-column padding', () => {
    const ascii = renderMermaidASCII(
      `erDiagram
        CUSTOMER {
          string name
        }`,
      { colorMode: 'none' },
    )
    // No keys anywhere: only the type and name columns exist, as in mermaid.
    expect(rows(ascii)).toEqual([['string', 'name']])
  })

  it('keeps a mix of keyed and keyless attributes readable in the same entity', () => {
    const ascii = renderMermaidASCII(
      `erDiagram
        CUSTOMER {
          string name PK
          string email UK
          int age
        }`,
      { colorMode: 'none' },
    )
    expect(rows(ascii)).toEqual([
      ['string', 'name', 'PK'],
      ['string', 'email', 'UK'],
      ['int', 'age', ''],
    ])
  })
})
