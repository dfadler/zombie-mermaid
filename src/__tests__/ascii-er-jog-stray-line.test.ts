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
//
// A bare "││"/"┊┊" substring is not on its own proof of this bug: a
// same-row (horizontal) connection's flush-against-the-border crow's-foot
// marker for "one" cardinality is also a lone "│", so a "one"-cardinality
// relationship starting right at an entity's own right border legitimately
// prints "│<border>│<marker>" on the *same row* as the rest of that
// entity's box — see issue #351's marker-inset removal. The actual bug
// this test guards against instead leaves a *connector-only* row: a row
// whose sole non-blank content is the doubled glyph pair, with no entity
// box or text sharing that row, since the leftover stem runs down through
// empty space between two entity rows.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

/**
 * True when some row's only non-whitespace content is a doubled line/dash
 * glyph ("││" or "┊┊") — the signature of a leftover parallel vertical
 * stem left behind by an unstopped jog. A legitimate box-border-flush-
 * against-a-marker "││" always shares its row with other box/text
 * content (the entity's own border and label), so it's excluded by
 * requiring the rest of the row to be blank.
 */
function hasStrayDuplicateColumn(ascii: string): boolean {
  return ascii.split('\n').some((line) => {
    for (const pattern of ['││', '┊┊']) {
      const col = line.indexOf(pattern)
      if (col === -1) continue
      const rest = line.slice(0, col) + line.slice(col + pattern.length)
      if (rest.trim() === '') return true
    }
    return false
  })
}

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

    expect(hasStrayDuplicateColumn(ascii)).toBe(false)
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

    expect(hasStrayDuplicateColumn(ascii)).toBe(false)
  })
})
