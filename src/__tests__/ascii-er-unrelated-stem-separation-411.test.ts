// ============================================================================
// ASCII ER diagram regression test for issue #411:
//
// Two *unrelated* relationships' vertical stems can land on adjacent (not
// identical) columns purely by coincidence — when that happens, nothing in
// the rendered output distinguishes them, so a reader sees what looks like
// one connector that inexplicably bends sideways partway down, rather than
// two independent lines. This is different from #350 (content overwrite,
// already fixed) and #351 (routing collisions/gutters, already fixed): no
// character is ever corrupted here, the two stems just sit close enough to
// be mistaken for each other.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

describe('ASCII ER — unrelated relationship stems stay visually separated (issue #411)', () => {
  it('keeps CUSTOMER→ADDRESS and PRODUCT→LINE_ITEM stems at least one column apart', () => {
    // The exact repro from issue #411: CUSTOMER's own stem (toward ADDRESS)
    // and PRODUCT/LINE_ITEM's own stem land on entity-center columns that
    // are only 1 apart by coincidence (12-wide CUSTOMER vs. 11-wide
    // PRODUCT, both starting at column 0 in their own row) — before the
    // fix, that put a bare '│' from one relationship immediately beside a
    // '┌'/'┼' from the other, with no blank column between them:
    //
    //   ┼                                     ╢○
    //  ┌│appears_in ───── has ─────────────────┘
    //  │└───────────────┐
    //  ┼               ○╟
    //
    // ("appears_in" is PRODUCT→LINE_ITEM's own label; "has" is
    // CUSTOMER→ADDRESS's own label — the two relationships have nothing to
    // do with each other, so their stems must read as visually distinct.)
    const ascii = renderMermaidASCII(
      `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    PRODUCT ||--o{ LINE_ITEM : appears_in
    CUSTOMER ||--o{ ADDRESS : has`,
      { colorMode: 'none' },
    )

    // The pre-fix signature: PRODUCT/LINE_ITEM's corner immediately
    // followed, with no gap, by CUSTOMER/ADDRESS's vertical stem.
    expect(ascii).not.toContain('┌│appears_in')
    expect(ascii).not.toContain('│└───────────────┐')

    // A blank column now separates the two relationships' stems on every
    // row where both are present.
    expect(ascii).toContain('┌ appears_in')
    expect(ascii).toContain('│ │ has')
    expect(ascii).toContain('┼ └')
  })

  it('does not corrupt a corner glyph when escalating a jog to avoid an unrelated stem (issue #411 fix side effect)', () => {
    // A denser diagram where two different vertical relationships'
    // natural columns land close enough to trigger the #411 separation
    // logic on both sides. Before a follow-up fix, the escalation could
    // pick a "via" column identical to another relationship's own column,
    // silently overwriting its corner glyph with a plain vertical bar.
    const ascii = renderMermaidASCII(
      `erDiagram
  STUDENT {
    int id PK
    string name
    date dob
    string grade
  }
  TEACHER {
    int id PK
    string name
    string department
  }
  COURSE {
    int id PK
    string title
    int teacher_id FK
    int credits
  }
  ENROLLMENT {
    int id PK
    int student_id FK
    int course_id FK
    string semester
    float grade
  }
  TEACHER ||--o{ COURSE : teaches
  STUDENT ||--o{ ENROLLMENT : enrolled
  COURSE ||--o{ ENROLLMENT : has`,
      { colorMode: 'none' },
    )

    // TEACHER→COURSE's own corner, where its jog turns down into COURSE,
    // must survive intact rather than being overwritten by
    // STUDENT→ENROLLMENT's bypass column landing on the same cell.
    expect(ascii).toContain('┌ teaches')
  })
})
