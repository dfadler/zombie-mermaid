import { describe, it, expect } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import { parseClassDiagram } from '@zombie-mermaid/mermaid-parser'
import { layoutClassDiagramSync } from '../class/layout.ts'

const layout = (src: string) =>
  layoutClassDiagramSync(parseClassDiagram(splitStatements(src)))

// Mermaid places disconnected components left to right in declaration order
// (#1249). ELK's layered algorithm otherwise orders them by its own graph
// traversal, so the layout has to keep the declared order.
describe('class diagram disconnected components (#1249)', () => {
  it('places each component left to right in source order, in one row', () => {
    const p = layout(`classDiagram
  A <|-- B : inheritance
  C *-- D : composition
  E o-- F : aggregation
  G --> H : association
  I ..> J : dependency
  K ..|> L : realization`)
    const at = (id: string) => p.classes.find((c) => c.id === id)!
    const roots = ['A', 'C', 'E', 'G', 'I', 'K'].map((id) => at(id))
    const lefts = roots.map((c, i) => Math.min(c.x, at('BDFHJL'[i]!).x))
    for (let i = 1; i < lefts.length; i++) {
      expect(lefts[i]!).toBeGreaterThan(lefts[i - 1]!)
    }
    // Single row: every component starts at the same top.
    expect(new Set(roots.map((c) => c.y)).size).toBe(1)
  })

  it('orders components by first appearance, not by relationship order', () => {
    const p = layout(`classDiagram
  class Z
  class Y
  Z <|-- Q
  Y <|-- R`)
    const x = (id: string) => p.classes.find((c) => c.id === id)!.x
    expect(x('Z')).toBeLessThan(x('Y'))
  })
})
