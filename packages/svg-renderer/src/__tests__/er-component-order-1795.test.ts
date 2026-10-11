import { describe, it, expect } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import { parseErDiagram } from '@zombie-mermaid/mermaid-parser'
import { layoutErDiagramSync } from '../er/layout.ts'

const layout = (src: string) =>
  layoutErDiagramSync(parseErDiagram(splitStatements(src)))

// Mermaid places disconnected components in declaration order (#1795). ELK
// orders them by width, so a wide first pair (long label) landed last.
describe('ER diagram disconnected components (#1795)', () => {
  it('keeps source order when the first component is the widest', () => {
    const p = layout(`erDiagram
  A ||--|| B : "a very long label here"
  C ||--|| D : x
  E ||--|| F : y
  G ||--|| H : z`)
    const x = (id: string) => p.entities.find((e) => e.id === id)!.x
    expect(x('A')).toBeLessThan(x('C'))
    expect(x('C')).toBeLessThan(x('E'))
    expect(x('E')).toBeLessThan(x('G'))
  })
})
