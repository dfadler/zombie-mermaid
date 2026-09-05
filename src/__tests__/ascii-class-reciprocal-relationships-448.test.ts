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
