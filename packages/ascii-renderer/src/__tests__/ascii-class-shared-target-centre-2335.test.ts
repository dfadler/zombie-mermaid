/**
 * Regression test for issue #2335: when two relationships share a class and
 * only one carries an arrowhead there, both lines now converge on the box's
 * centre (as mermaid does) instead of fanning to its corner columns, so the
 * arrowhead no longer sits over a corner glyph.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const SRC = `classDiagram
  class A
  class B
  class C
  class D
  A <|-- B
  C <|-- D
  A --> C
  B --> D`

describe('ASCII class diagram — shared target merges at the centre (issue #2335)', () => {
  it('puts the arrowhead above the centre column of D, not a corner', () => {
    const rows = renderMermaidASCII(SRC).split('\n')
    const dTop = rows.findIndex(
      (r, i) => r.includes('┌───┐') && rows[i + 1]?.includes('│ D │'),
    )
    expect(dTop).toBeGreaterThan(0)
    const left = rows[dTop]!.indexOf('┌')
    const head = rows[dTop - 1]!.indexOf('▼')
    expect(head).toBe(left + 2)
    // Both lines join in the row above the head (a merged `└─▼─┘` bar)
    expect(rows[dTop - 1]).toContain('└─▼─┘')
  })
})
