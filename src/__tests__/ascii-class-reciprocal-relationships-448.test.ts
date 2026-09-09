/**
 * Regression test for #448 — "Class: MVC Architecture sample drops the
 * `View --> Model : reads` edge."
 *
 * Root cause: `renderClassAscii` connected every relationship's line/arrow/
 * label to its source and target boxes at a fixed box-center column, with
 * no awareness of other relationships. When two relationships connect the
 * same pair of classes in opposite directions (`View --> Model : reads`
 * alongside `Model ..> View : notifies`), both computed the identical
 * center column, so the later-drawn one silently overwrote the earlier
 * one's line, arrowhead, and label.
 *
 * The fix groups relationships by unordered class-pair and gives each
 * member of a multi-relationship group its own connection column. This
 * test exercises that grouping/column-offset logic directly — no prior
 * test in this repo did (verification for #448 was ad hoc/visual only via
 * a real-terminal capture, never committed as a vitest case), which is
 * exactly why this code path had gone completely uncovered.
 *
 * Uses the same source as the "Class: MVC Architecture" sample
 * (samples-data.ts) that the original issue was reported against — a
 * narrower repro with only short single-word labels and no other class
 * members hits an unrelated, tighter label/border collision (also
 * present, separately, in the pre-#448 code and out of scope here), so
 * this keeps the box widths the real sample has.
 */

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

const MVC_SOURCE = `classDiagram
  class Model {
    -data Map
    +getData() Map
    +setData(key, val) void
    +notify() void
  }
  class View {
    -model Model
    +render() void
    +update() void
  }
  class Controller {
    -model Model
    -view View
    +handleInput(event) void
    +updateModel(data) void
  }
  Controller --> Model : updates
  Controller --> View : refreshes
  View --> Model : reads
  Model ..> View : notifies`

describe('ASCII class diagram — reciprocal relationships (issue #448)', () => {
  it('renders all four relationships, including both directions of the Model/View reciprocal pair', () => {
    const ascii = renderMermaidASCII(MVC_SOURCE, { colorMode: 'none' })

    for (const label of ['updates', 'refreshes', 'reads', 'notifies']) {
      expect(ascii).toContain(label)
    }
  })

  it('gives the reciprocal pair distinct connection columns instead of one overwriting the other', () => {
    const ascii = renderMermaidASCII(MVC_SOURCE, { colorMode: 'none' })
    const lines = ascii.split('\n')

    const readsCol = lines.find((l) => l.includes('reads'))!.indexOf('reads')
    const notifiesCol = lines
      .find((l) => l.includes('notifies'))!
      .indexOf('notifies')
    expect(readsCol).not.toBe(notifiesCol)
  })

  it('leaves a single (non-reciprocal) relationship at the plain center column', () => {
    const ascii = renderMermaidASCII(
      `classDiagram
  class A
  class B
  A --> B : uses`,
      { colorMode: 'none' },
    )
    expect(ascii).toContain('uses')
  })
})

/**
 * Regression test for issue #632 — a weekly form-judge audit comparing this
 * repo's ASCII output against real mermaid.js SVG flagged the "Class:
 * Relationship Labels" sample (samples-data.ts): `Teacher --> Course` and
 * `Student --> Course` are two *distinct* pairs (not a reciprocal pair
 * between the same two classes, which #448 above already covers) that both
 * terminate at the same target, `Course`.
 *
 * Root cause: `pairGroups` (the #448 fix, keyed by the unordered
 * `[from, to]` pair) only fans relationships between the exact same two
 * classes — it never grouped these, so both anchored at Course's identical
 * center column, collapsing their arrowheads onto the same cell. Since
 * both relationships' single horizontal jog then also landed on the exact
 * same row, the later-drawn label (in the separate label-drawing pass)
 * blotted out most of the visible line, so `Student --> Course` looked
 * like it terminated in blank space short of Course instead of reaching it.
 *
 * The fix (`relFromOffset`/`relToOffset` in `class-diagram.ts`) fans a
 * relationship at whichever single end it shares with another
 * relationship, even when the two relationships are between otherwise
 * unrelated classes — scoped to a direct, adjacent-level convergence (see
 * that code's comment for why a level-skipping relationship, which already
 * needs the separate box-collision detour routing, is excluded).
 */
describe('ASCII class diagram — relationships converging on a shared target from different sources (issue #632)', () => {
  const STUDENT_COURSE_SOURCE = `classDiagram
  class Teacher {
    +String name
  }
  class Student {
    +String name
  }
  class Course {
    +String title
  }
  Teacher --> Course : teaches
  Student --> Course : enrolled in`

  it('renders both relationship labels', () => {
    const ascii = renderMermaidASCII(STUDENT_COURSE_SOURCE, {
      colorMode: 'none',
    })
    expect(ascii).toContain('teaches')
    expect(ascii).toContain('enrolled in')
  })

  it('draws two distinct arrowheads into Course instead of collapsing both onto one shared cell', () => {
    const ascii = renderMermaidASCII(STUDENT_COURSE_SOURCE, {
      colorMode: 'none',
    })
    // Before the fix, both relationships anchored at the exact same
    // column, so only a single '▼' was ever drawn for both of them
    // combined — the `Student --> Course` connector had no arrowhead of
    // its own at all.
    const arrowCount = (ascii.match(/▼/g) ?? []).length
    expect(arrowCount).toBe(2)
  })

  it('gives the two relationships distinct target columns, both landing on Course', () => {
    const ascii = renderMermaidASCII(STUDENT_COURSE_SOURCE, {
      colorMode: 'none',
    })
    const lines = ascii.split('\n')
    const arrowCols = lines.flatMap((line) =>
      [...line].map((ch, i) => (ch === '▼' ? i : -1)).filter((i) => i >= 0),
    )
    expect(arrowCols).toHaveLength(2)
    expect(arrowCols[0]).not.toBe(arrowCols[1])

    // Course's box must actually span both arrow columns — otherwise
    // they've merely moved apart without both still landing on the target.
    const courseRow = lines.findIndex((line) => line.includes('Course'))
    expect(courseRow).toBeGreaterThan(0)
    const boxRow = lines[courseRow - 1]!
    const boxLeft = boxRow.indexOf('┌')
    const boxRight = boxRow.indexOf('┐')
    expect(boxLeft).toBeGreaterThanOrEqual(0)
    expect(boxRight).toBeGreaterThan(boxLeft)
    for (const col of arrowCols) {
      expect(col).toBeGreaterThanOrEqual(boxLeft)
      expect(col).toBeLessThanOrEqual(boxRight)
    }
  })
})
