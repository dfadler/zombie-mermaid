/**
 * #2547: mermaid 12.2.0 (and 12.3.0) draw an attribute-less entity as a
 * header-only box: no "(no attributes)" row and no header divider.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

const lines = (svg: string): number => svg.match(/<line /g)?.length ?? 0

describe('ER entity without attributes (#2547)', () => {
  it('draws no placeholder row', () => {
    const svg = renderMermaidSVG('erDiagram\n  A ||--o{ B : has\n')
    expect(svg).not.toContain('no attributes')
  })

  it('draws the table lines only for entities with attributes', () => {
    const bare = renderMermaidSVG('erDiagram\n  A {\n  }\n')
    const full = renderMermaidSVG('erDiagram\n  A {\n    int id PK\n  }\n')
    // The header divider plus a divider between each of the 3 columns (type, name, keys)
    expect(lines(full) - lines(bare)).toBe(1 + 2)
  })
})
