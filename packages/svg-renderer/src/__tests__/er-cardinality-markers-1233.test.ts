/**
 * #1233: one-or-many (`|{`) was drawn as a bare crow's foot. The visual suite's
 * tolerance can't see a missing bar, so assert the drawn primitives directly.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

function count(src: string): { lines: number; circles: number } {
  const svg = renderMermaidSVG(src)
  return {
    lines: (svg.match(/<line /g) ?? []).length,
    circles: (svg.match(/<circle /g) ?? []).length,
  }
}

/** Primitives drawn for the right-hand cardinality token, net of an `||` end. */
function rightEnd(token: string): { lines: number; circles: number } {
  const base = count('erDiagram\n  A ||--|| B : r')
  const v = count(`erDiagram\n  A ||--${token} B : r`)
  return { lines: v.lines - base.lines, circles: v.circles - base.circles }
}

describe('ER cardinality markers (#1233)', () => {
  it('draws one-or-many as foot (3 lines) + bar, vs 2 lines for exactly one', () => {
    expect(rightEnd('|{')).toEqual({ lines: 2, circles: 0 })
  })

  it('draws zero-or-many as foot + circle, with no bar', () => {
    expect(rightEnd('o{')).toEqual({ lines: 1, circles: 1 })
  })

  it('distinguishes one-or-many from zero-or-many', () => {
    expect(rightEnd('|{')).not.toEqual(rightEnd('o{'))
  })
})
