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

describe('ASCII ER attribute columns render as type/name/keys (issue #1134)', () => {
  it('renders a single-key attribute as "type name KEY", not "KEY type name"', () => {
    const ascii = renderMermaidASCII(
      `erDiagram
        ORDER {
          int id PK
        }`,
      { colorMode: 'none' },
    )
    expect(ascii).toContain('int id PK')
    expect(ascii).not.toContain('PK int id')
  })

  it('renders a multi-key attribute\'s keys joined and trailing, e.g. "type name PK,FK"', () => {
    const ascii = renderMermaidASCII(
      `erDiagram
        LINE_ITEM {
          int product_id PK FK
        }`,
      { colorMode: 'none' },
    )
    expect(ascii).toContain('int product_id PK,FK')
    expect(ascii).not.toContain('PK,FK int product_id')
  })

  it('renders a keyless attribute with no reserved key-column padding', () => {
    const ascii = renderMermaidASCII(
      `erDiagram
        CUSTOMER {
          string name
        }`,
      { colorMode: 'none' },
    )
    // The pre-#1134 format always reserved a fixed-width 3-space key
    // prefix ('   ') even when an attribute had no key at all — a keyless
    // attribute now renders with nothing but its own type/name text, so
    // the entity's box no longer wastes 3 columns it never needed.
    expect(ascii).toContain('string name')
    expect(ascii).not.toContain('   string name')
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
    expect(ascii).toContain('string name PK')
    expect(ascii).toContain('string email UK')
    expect(ascii).toContain('int age')
  })
})
