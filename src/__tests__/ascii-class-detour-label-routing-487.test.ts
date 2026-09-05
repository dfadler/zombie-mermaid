/**
 * Regression test for #487 — "ASCII class diagram: relationship labels
 * ignore detour routing, appear attached to wrong box."
 *
 * Root cause: `renderClassAscii` anchored every relationship's label at the
 * *idealized straight-line* midpoint between its source and target
 * connection columns (`idealMidX = Math.floor((fromCX + toCX) / 2)`), even
 * when the relationship's line actually detours around an intermediate box
 * (the `needsDetour` / `findClearColumn` branch). On the "Class: MVC
 * Architecture" sample, `Controller --> View : refreshes` detours around
 * `Model` to reach `View`, but its label still anchored on the straight
 * Controller/View midpoint — which happened to coincide with
 * `Controller --> Model : updates`'s own (non-detoured, correct) label one
 * row below it, making both labels read as though they terminated at
 * `Model`.
 *
 * The fix (`computeLabelAnchor` in `class-diagram.ts`) anchors a detoured
 * relationship's label on its *actual routed path* instead: the midpoint of
 * the detour's vertical trunk (falling back to the longer horizontal jog
 * when the trunk has no vertical room), flush against the trunk's clear
 * side rather than centered on it — centering a label on the trunk's single
 * clear column would re-overlap the very box the trunk was routed around,
 * since `findClearColumn` only guarantees that one column is clear, not a
 * whole label-width window.
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

describe('ASCII class diagram — detour-aware relationship label placement (issue #487)', () => {
  it("places `refreshes` on its own row, off `updates`'s arrowhead column", () => {
    const ascii = renderMermaidASCII(MVC_SOURCE, { colorMode: 'none' })
    const lines = ascii.split('\n')

    const updatesRow = lines.findIndex((l) => l.includes('updates'))
    const refreshesRow = lines.findIndex((l) => l.includes('refreshes'))
    expect(updatesRow).toBeGreaterThanOrEqual(0)
    expect(refreshesRow).toBeGreaterThanOrEqual(0)

    // Before the fix, both labels sat on adjacent rows directly above the
    // single arrowhead entering Model, reading as though both relationships
    // terminated there. `refreshes` must not share `updates`'s column range
    // (the sole visual cue, pre-fix, that made them look like the same
    // termination) on any row, and in particular not on `updates`'s own row.
    expect(refreshesRow).not.toBe(updatesRow)

    const updatesLine = lines[updatesRow]!
    const updatesStart = updatesLine.indexOf('updates')
    const updatesEnd = updatesStart + 'updates'.length - 1

    const refreshesLine = lines[refreshesRow]!
    const refreshesStart = refreshesLine.indexOf('refreshes')
    const refreshesEnd = refreshesStart + 'refreshes'.length - 1

    // No column overlap between the two labels anywhere they might appear.
    const overlapsColumns =
      refreshesStart <= updatesEnd && updatesStart <= refreshesEnd
    expect(overlapsColumns).toBe(false)
  })

  it("anchors `refreshes` past Model's right border, not centered inside its footprint", () => {
    const ascii = renderMermaidASCII(MVC_SOURCE, { colorMode: 'none' })
    const lines = ascii.split('\n')

    // Model's top border row (e.g. "┌───────────────────────────┐│") gives
    // its right-edge column directly. `refreshes` — the label for the
    // relationship that detours around Model to reach View — must land
    // strictly to the right of that border on every row it occupies, never
    // overlapping Model's own footprint the way the straight-line midpoint
    // used to (issue #487).
    const modelTopRow = lines.findIndex(
      (l, i) => /^┌─+┐/.test(l) && (lines[i + 1]?.includes('Model') ?? false),
    )
    expect(modelTopRow).toBeGreaterThanOrEqual(0)
    const modelRightBorder = lines[modelTopRow]!.indexOf('┐')
    expect(modelRightBorder).toBeGreaterThan(0)

    const refreshesRow = lines.findIndex((l) => l.includes('refreshes'))
    expect(refreshesRow).toBeGreaterThanOrEqual(0)
    const refreshesStart = lines[refreshesRow]!.indexOf('refreshes')
    expect(refreshesStart).toBeGreaterThan(modelRightBorder)
  })

  it('does not move any non-detoured relationship label (reads, notifies, updates stay put)', () => {
    const ascii = renderMermaidASCII(MVC_SOURCE, { colorMode: 'none' })
    for (const label of ['updates', 'reads', 'notifies', 'refreshes']) {
      expect(ascii).toContain(label)
    }
    expect(ascii).not.toContain('…')
  })
})
