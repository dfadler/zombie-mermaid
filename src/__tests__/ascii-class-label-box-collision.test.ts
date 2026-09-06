/**
 * Regression test for a pre-existing, previously-untested branch in
 * `renderClassAscii`'s label placement: when a relationship's label would
 * land inside another class's box (e.g. a "skip" edge whose two endpoints
 * straddle a third class positioned between them), the renderer must find
 * a clear gap instead of overwriting that box's content.
 *
 * `A --> C : skips`, with `B` (from the unrelated `A --> B --> C` chain)
 * positioned directly between them, puts `skips`'s ideal label position
 * inside B's box — this covers `renderClassAscii`'s `labelInBox` /
 * gap-search fallback.
 *
 * Since #487's detour-aware label placement, `skips` (which detours around
 * B) anchors on its own detour trunk — a column past B's right border —
 * rather than searching for an entirely box-free *row*. That can legitimately
 * put the label on the same terminal row as one of B's content lines (the
 * same pattern the MVC sample's `refreshes` label uses, sharing a row with
 * Model's compartment separator), as long as it never overlaps B's own
 * *columns* — this test now checks that non-overlap directly instead of
 * requiring a different row entirely.
 */

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

describe('ASCII class diagram — label collision with an intermediate box', () => {
  it('moves a skip-edge label out of an intermediate class box instead of overwriting it', () => {
    const ascii = renderMermaidASCII(
      `classDiagram
  class A
  class B
  class C
  A --> B
  B --> C
  A --> C : skips`,
      { colorMode: 'none' },
    )

    const lines = ascii.split('\n')
    const labelRow = lines.findIndex((l) => l.includes('skips'))
    expect(labelRow).toBeGreaterThanOrEqual(0)

    // B's box must still render intact — "B" itself, and both of its box
    // borders — nowhere overwritten by the "skips" label text: wherever the
    // label lands (even on the same row as one of B's own lines), its
    // columns must fall entirely outside B's box columns.
    const bRow = lines.findIndex((l) => l.includes('│ B │'))
    expect(bRow).toBeGreaterThanOrEqual(0)
    const bLine = lines[bRow]!
    const bBoxStart = bLine.indexOf('│ B │')
    const bBoxEnd = bBoxStart + '│ B │'.length - 1

    const labelLine = lines[labelRow]!
    const labelStart = labelLine.indexOf('skips')
    const labelEnd = labelStart + 'skips'.length - 1
    const overlapsOnSharedRow =
      labelRow === bRow && labelStart <= bBoxEnd && bBoxStart <= labelEnd
    expect(overlapsOnSharedRow).toBe(false)
  })
})
