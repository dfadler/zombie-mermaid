// ============================================================================
// ASCII ER diagram: a vertical relationship's jog must not leave a stray
// duplicate line at its original column
//
// renderErAscii's vertical-connection branch always drew the initial
// straight vertical line for the *entire* startY..endY span at the upper
// entity's own center column (lineX), even when a horizontal jog then
// redirects the path to the lower entity's center column (lowerCX). Below
// the jog row, that left two parallel vertical segments where only one
// path exists: the "real" one at lowerCX (leading into the lower entity),
// and a leftover one still running the rest of the way down at the
// *original* lineX — connected to nothing, since the path already turned.
// Spotted as an unexplained doubled "││" / "┊┊" glyph pair in a real
// catalog sample's rendered output.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

describe('ASCII ER vertical relationship jog does not leave a stray duplicate line', () => {
  it('does not draw a leftover line at the original column once a relationship has jogged over', () => {
    // Real catalog sample ("ER: Non-Identifying (Dashed) Relationship"):
    // USER-SESSION needs a horizontal jog (their centers don't align), so
    // its path runs straight down from USER, jogs sideways, then straight
    // down into SESSION. Before this fix, the row directly below the jog
    // showed two dotted-line glyphs side by side ("┊┊") instead of one —
    // the real jogged path, plus a stray remnant of the pre-jog column
    // that was never told to stop.
    const ascii = renderMermaidASCII(
      `erDiagram
        USER ||--o{ LOG_ENTRY : generates
        USER ||..o{ SESSION : opens`,
      { colorMode: 'none' },
    )

    expect(ascii).not.toContain('┊┊')
    expect(ascii).not.toContain('││')
  })

  it('does not draw a leftover line for either of two independently-jogging relationships', () => {
    // Real catalog sample ("ER: School Management Schema"): both
    // STUDENT-COURSE ("enrolled") and TEACHER-ENROLLMENT ("teaches") jog
    // over to reach their lower entity. Before this fix, the row right
    // below each jog showed a doubled "│╟"/"││" pair on both sides at
    // once — confirming the leftover-column bug wasn't specific to one
    // relationship's geometry.
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
        STUDENT ||--o{ COURSE : enrolled
        TEACHER ||--o{ ENROLLMENT : teaches
        COURSE ||--o{ ENROLLMENT : has`,
      { colorMode: 'none' },
    )

    expect(ascii).not.toContain('┊┊')
    expect(ascii).not.toContain('││')
  })
})
