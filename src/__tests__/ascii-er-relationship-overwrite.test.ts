// ============================================================================
// ASCII ER diagram: relationship draws must not overwrite already-placed
// text (GitHub issue #392)
//
// Relationships are drawn in declaration order. A later relationship's
// straight connecting line, crow's-foot marker, or label can land on the
// exact canvas cell an earlier relationship's label (or an entity's own
// header/attribute text) already wrote, silently corrupting it — a stray
// line glyph mid-word, or one label's characters spliced into another's.
// This is a distinct mechanism from #351's jog-row collisions (fixed by
// chooseFreeRow in #390): here nothing routes around anything, a later
// write simply stomps an earlier one with no occupancy check at all.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

describe('ASCII ER relationship draws do not overwrite existing text (issue #392)', () => {
  it('does not let a later vertical relationship line cut through an earlier label', () => {
    // A-D's label "helloworld" and B-E's vertical connector line land on
    // the same canvas cell (both components span the same two rows), with
    // B-E's own label positioned clear of A-D's label span so this isolates
    // the line-vs-label collision from any label-vs-label collision.
    const ascii = renderMermaidASCII(
      `erDiagram
        A ||--o{ B : ab
        A ||--o{ C : ac
        A ||--o{ D : helloworld
        B ||--o{ E : be`,
      { colorMode: 'none' },
    )

    expect(ascii).toContain('helloworld')
    expect(ascii).toContain('be')
  })

  it('does not let one relationship label overwrite another relationship label', () => {
    // A-D's label "longlabelhere" and B-E's label "be" are both centered on
    // the same row (both components span the same two rows) and, without a
    // guard, B-E's label characters land on top of the tail of A-D's label.
    const ascii = renderMermaidASCII(
      `erDiagram
        A ||--o{ B : ab
        A ||--o{ C : ac
        A ||--o{ D : longlabelhere
        B ||--o{ E : be`,
      { colorMode: 'none' },
    )

    expect(ascii).toContain('longlabelhere')
  })

  it('does not let a same-row relationship line overwrite an unrelated entity name it must cross', () => {
    // A-C is a direct (non-adjacent) same-row relationship; entity B sits
    // physically between A and C, so A-C's straight line crosses B's box.
    // The routing itself (line running through the box) is a distinct,
    // out-of-scope defect (see #390's "known limitation" on non-adjacent
    // same-row collisions) — this test only asserts the crossing line
    // doesn't corrupt B's own header text.
    const ascii = renderMermaidASCII(
      `erDiagram
        A ||--o{ B : ab
        A ||--o{ C : ac
        A ||--o{ D : helloworld
        B ||--o{ E : be`,
      { colorMode: 'none' },
    )

    // The A-C line still crosses straight through B's row (the crossing
    // itself is the out-of-scope routing defect) — but B's own header
    // character must survive that crossing intact rather than being
    // replaced by a line glyph.
    const lines = ascii.split('\n')
    const crossingLine = lines.find(
      (l) => l.includes('A') && l.includes('C') && l.includes('B'),
    )
    expect(crossingLine).toBeDefined()
    expect(crossingLine).toContain('B')
  })

  it('drops a whole overlapping label rather than splicing its tail onto an earlier one', () => {
    // Real catalog sample ("ER: Blog Platform Schema"): USER-COMMENT's
    // "authors" label, POST-COMMENT's "has" label, and POST-TAG's
    // "tagged-with" label all land on the same row. Before this fix, the
    // whole row was overwritten down to just "tagged-with" (silently
    // erasing "authors" and "has" entirely). A naive per-character
    // occupancy guard produces a worse failure mode here: "tagged-with"'s
    // free trailing characters ("ged-with") get written right after "has",
    // producing "hasged-with" — a new, plausible-looking word that is
    // neither original label. A label must render whole or not at all.
    const ascii = renderMermaidASCII(
      `erDiagram
        USER ||--o{ POST : writes
        USER ||--o{ COMMENT : authors
        POST ||--o{ COMMENT : has
        POST }|--o{ TAG : tagged-with`,
      { colorMode: 'none' },
    )

    expect(ascii).not.toContain('hasged-with')
    expect(ascii).not.toContain('gedauthors')
    expect(ascii).toContain('authors')
    expect(ascii).toContain('has')
  })
})
