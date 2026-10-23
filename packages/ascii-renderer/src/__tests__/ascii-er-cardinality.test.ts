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

  it('draws vertical markers as a foot or tick against the box, with the circle on the line one row further (#2081, #2083)', () => {
    // Default ER layout stacks entities top to bottom, so these markers sit
    // on a vertical run, like mermaid's own (foot against the entity, circle
    // one marker further along the line). The upper entity's marker opens
    // downward, the lower one's upward, and neither reuses ╟/╢.
    const rows = (src: string, useAscii: boolean) =>
      renderMermaidASCII(`erDiagram\n  ${src}`, { useAscii }).split('\n')
    const col = (line: string | undefined, ch: string) => line?.indexOf(ch)

    for (const [useAscii, foot, tick, circle, up, border, boxTop] of [
      [false, '╤', '┼', '○', '╧', /└─+┘/, /┌─+┐/],
      [true, 'V', '+', 'o', '^', /\+-+\+/, /\+-+\+/],
    ] as const) {
      // zero-many on both ends: foot flush on each box, circle on the line.
      const both = rows('A }o--o{ B : r', useAscii)
      const top = both.findIndex((l) => l.trim() === foot)
      expect(top, `${foot} row`).toBeGreaterThan(0)
      expect(both[top - 1]).toMatch(border)
      expect(both[top + 1]!.trim()).toBe(circle)
      expect(col(both[top + 1], circle)).toBe(col(both[top], foot))
      const bottom = both.findIndex((l) => l.trim() === up)
      expect(both[bottom - 1]!.trim()).toBe(circle)
      expect(col(both[bottom - 1], circle)).toBe(col(both[bottom], up))
      expect(both[bottom + 1]).toMatch(boxTop)

      // zero-one: the tick takes the foot's place.
      const one = rows('A |o--o| B : r', useAscii)
      const t = one.findIndex((l) => l.trim() === tick)
      expect(one[t - 1]).toMatch(border)
      expect(one[t + 1]!.trim()).toBe(circle)
      expect(one.join('\n')).not.toMatch(/[╟╢]/)
    }
  })
})
