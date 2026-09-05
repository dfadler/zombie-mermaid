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
    // borders — nowhere overwritten by the "skips" label text.
    const bRow = lines.findIndex((l) => l.includes('│ B │'))
    expect(bRow).toBeGreaterThanOrEqual(0)
    expect(labelRow).not.toBe(bRow)
  })
})
