/**
 * Regression test for a bug discovered while integrating issue #447 with
 * issue #448: `renderClassAscii`'s label-territory precomputation
 * (added for #447) split/truncated two labels whenever their *horizontal*
 * positions were close, even when the two relationships render on
 * completely different rows and never actually visually collide — e.g.
 * one class's two separate outgoing edges to two different targets at
 * different heights (`Controller --> Model : updates` and
 * `Controller --> View : refreshes` in the "Class: MVC Architecture"
 * sample, which — before this fix — rendered as `refre…`/`…ates` even
 * though nothing else was drawn anywhere near those cells).
 *
 * The fix tracks each label's row span (rowStart/rowEnd, mirroring the
 * draw pass's own baseMidY calculation) and only treats two labels as
 * needing territory-splitting when their row spans actually overlap.
 */

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

describe('ASCII class diagram — label territory is row-aware (issue #447 follow-up)', () => {
  it('does not truncate two labels whose relationships share a source but target different, differently-positioned classes', () => {
    // Uses the full "Class: MVC Architecture" sample source (samples-data.ts)
    // — reproducing this needs its exact box layout; a hand-trimmed subset
    // (e.g. dropping the `reads`/`notifies` pair) shifts row positions
    // enough that `updates`/`refreshes` no longer collide, defeating the
    // regression check.
    const ascii = renderMermaidASCII(
      `classDiagram
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
  Model ..> View : notifies`,
      { colorMode: 'none' },
    )

    expect(ascii).toContain('updates')
    expect(ascii).toContain('refreshes')
  })
})
