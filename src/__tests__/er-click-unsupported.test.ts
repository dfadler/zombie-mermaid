/**
 * ER diagrams: `click` href/tooltip interactions are intentionally
 * unimplemented (issue #292).
 *
 * Unlike flowcharts/state diagrams (src/parser.ts) and class diagrams
 * (src/class/parser.ts, added alongside this file — see
 * class-click-interactions.test.ts), Mermaid's *own* erDiagram grammar has
 * no `click` directive to parse: as of this writing, upstream support is an
 * open, unmerged feature request (mermaid-js/mermaid#2880, PR #6985), not a
 * shipped part of the language. Guessing at a syntax Mermaid itself hasn't
 * settled on would risk diverging from whatever upstream eventually ships —
 * the same reasoning already applied to subgraph collapse syntax in
 * docs/diagrams.md's "Known limitations" section.
 *
 * This file documents the resulting behavior as an intentional contract, not
 * a gap discovered by accident: a `click` line inside an erDiagram is inert.
 * It is not recognized as an entity, an attribute, or a relationship, so it
 * neither renders a link/tooltip nor corrupts the rest of the diagram.
 */
import { describe, it, expect } from 'vitest'
import { parseErDiagram } from '../er/parser.ts'
import { renderMermaidSVG } from '../index.ts'

/** Helper to parse — preprocesses text the same way index.ts does */
function parse(text: string) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('%%'))
  return parseErDiagram(lines)
}

describe('parseErDiagram – click statements are a no-op', () => {
  it('does not create a stray entity from a click line', () => {
    const d = parse(`erDiagram
      CUSTOMER ||--o{ ORDER : places
      click CUSTOMER "https://example.com"`)
    expect(d.entities.map((e) => e.id).sort()).toEqual(['CUSTOMER', 'ORDER'])
  })

  it('does not add a stray attribute to the referenced entity', () => {
    const d = parse(`erDiagram
      CUSTOMER {
        int id PK
      }
      click CUSTOMER "https://example.com" "Tooltip"`)
    const customer = d.entities.find((e) => e.id === 'CUSTOMER')!
    expect(customer.attributes).toHaveLength(1)
  })
})

describe('renderMermaidSVG – ER diagrams render unaffected by a click line', () => {
  it('renders no <a href> or callback data for a click statement', () => {
    const svg = renderMermaidSVG(`erDiagram
      CUSTOMER ||--o{ ORDER : places
      click CUSTOMER "https://example.com" "Tooltip"`)
    expect(svg).not.toContain('<a href=')
    expect(svg).not.toContain('data-click-callback')
    // The diagram itself still renders normally — the click line is simply
    // ignored, not a parse error.
    expect(svg).toContain('CUSTOMER')
    expect(svg).toContain('ORDER')
    expect(svg).toContain('places')
  })

  it('an erDiagram with no click statement renders identically either way', () => {
    const base = `erDiagram
      CUSTOMER ||--o{ ORDER : places`
    const withClick = `${base}\n      click CUSTOMER "https://example.com"`
    expect(renderMermaidSVG(withClick)).toBe(renderMermaidSVG(base))
  })
})
