// ============================================================================
// ASCII ER diagram regression tests for issue #351:
//   1. Stray/duplicated connector glyphs next to crow's-foot markers
//   2. Edges (and their labels) routed through/over other relationships or
//      entity boxes
//   3. Oversized blank gutters between disconnected components
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'
import { chooseFreeRow, isRowFree } from '../ascii/er-diagram.ts'
import { mkCanvas, write } from '../ascii/canvas.ts'
import type { Canvas } from '../ascii/types.ts'

/** Mark every cell in row `y` across [xStart, xEnd] as occupied. */
function occupyRow(canvas: Canvas, y: number, xStart: number, xEnd: number) {
  for (let x = xStart; x <= xEnd; x++) write(canvas, x, y, '#')
}

describe('ASCII ER — no stray connector glyph next to a marker (issue #351)', () => {
  it('does not leave a lone "one" tick floating between dashes on a horizontal connector (Unicode)', () => {
    const ascii = renderMermaidASCII(
      `erDiagram
        CUSTOMER ||--o{ ORDER : places`,
      { colorMode: 'none' },
    )
    // Before the fix, the marker was inset 1 cell from the border, leaving
    // the plain line-fill character ('─') on either side of the lone "one"
    // marker ('│') — rendering as "─│─", a bar that reads as noise because
    // it touches neither the entity border nor another marker glyph.
    expect(ascii).not.toMatch(/─│─/)
    // The marker instead sits flush against the CUSTOMER border, and the
    // zero-many cluster sits flush against the ORDER border.
    expect(ascii).toContain('CUSTOMER ││')
    expect(ascii).toContain('○╟│ ORDER')
  })

  it('does not leave a lone "one" tick floating between dashes on a horizontal connector (ASCII)', () => {
    const ascii = renderMermaidASCII(
      `erDiagram
        CUSTOMER ||--o{ ORDER : places`,
      { colorMode: 'none', useAscii: true },
    )
    expect(ascii).not.toMatch(/-\|-/)
  })

  it('does not leave a stray fill row between a vertical marker and its entity border', () => {
    // Forces a vertical (cross-row) connection: three entities with a
    // sqrt-based row limit of 2 per row wrap C onto its own row below A/B.
    const ascii = renderMermaidASCII(
      `erDiagram
        A ||--o{ B : ab
        A ||--o{ C : ac`,
      { colorMode: 'none' },
    )
    const lines = ascii.split('\n')

    // The zero-many marker for the A→C relationship ("○╟") must sit on the
    // row immediately before C's box starts — not with a leftover plain
    // "│" line-fill row (visually indistinguishable from a second "one"
    // tick) still separating it from the border. Before the fix, that
    // leftover row rendered as an extra stray "│" directly under "○╟".
    // Match only the *vertical* marker's own row — a bare "○╟" with nothing
    // but leading whitespace before it — not the A→B horizontal
    // relationship's identical-looking marker earlier in the output.
    const markerLineIdx = lines.findIndex((l) => /^\s*○╟\s*$/.test(l))
    expect(markerLineIdx).toBeGreaterThan(-1)
    const nextLine = lines[markerLineIdx + 1]
    expect(nextLine).toBeDefined()
    expect(nextLine!.trimStart().startsWith('┌')).toBe(true)
  })
})

describe('ASCII ER — relationships routed without colliding (issue #351)', () => {
  it('gives independent relationships between the same two rows distinct jog rows', () => {
    // B→C and A→C both terminate on C's row from A/B's row above; before
    // the fix, every vertical relationship's horizontal jog used the exact
    // same geometric midpoint, so B→C's jog and A→C's label landed on the
    // identical row and overwrote each other.
    const ascii = renderMermaidASCII(
      `erDiagram
        A ||--o{ B : rel1
        B ||--o{ C : rel2
        A ||--o{ C : rel3`,
      { colorMode: 'none' },
    )
    const lines = ascii.split('\n')

    const rel2Line = lines.find((l) => l.includes('rel2'))
    const rel3Line = lines.find((l) => l.includes('rel3'))
    expect(rel2Line).toBeDefined()
    expect(rel3Line).toBeDefined()
    // Both labels must render intact (not merged/garbled into the same row).
    expect(rel2Line).not.toBe(rel3Line)
    expect(ascii).toContain('rel1')
    expect(ascii).toContain('rel2')
    expect(ascii).toContain('rel3')
  })

  it('does not cut a relationship label with another relationship’s jog line', () => {
    // Five entities across two component rows, closely mirroring the
    // issue's own description: a later relationship's vertical/horizontal
    // segment used to cut straight through an earlier relationship's label,
    // e.g. "appears_in" rendered as "appear│_in".
    const ascii = renderMermaidASCII(
      `erDiagram
        CUSTOMER ||--o{ ORDER : places
        ORDER ||--|{ LINE_ITEM : contains
        PRODUCT ||--o{ LINE_ITEM : appears_in
        CUSTOMER ||--o{ ADDRESS : has`,
      { colorMode: 'none' },
    )
    // Every label must render as one intact, uninterrupted word — not
    // split by a stray line character routed through its middle.
    expect(ascii).toContain('places')
    expect(ascii).toContain('contains')
    expect(ascii).toContain('appears_in')
    expect(ascii).toContain('has')
    expect(ascii).not.toMatch(/[a-z]+[─│┊╌][a-z]+/)
  })
})

describe('ASCII ER — compact gutters between disconnected components (issue #351)', () => {
  it('does not leave a large blank gutter between two small disconnected components', () => {
    const ascii = renderMermaidASCII(
      `erDiagram
        CUSTOMER ||--o{ ORDER : places
        PRODUCT ||--o{ LINE_ITEM : appears_in`,
      { colorMode: 'none' },
    )
    const lines = ascii.split('\n')

    // Count the run of fully-blank lines between the two components.
    const firstBoxLine = lines.findIndex((l) => l.includes('└'))
    const secondComponentLine = lines.findIndex(
      (l, i) => i > firstBoxLine && l.includes('PRODUCT'),
    )
    expect(firstBoxLine).toBeGreaterThan(-1)
    expect(secondComponentLine).toBeGreaterThan(firstBoxLine)

    let blankRun = 0
    for (let i = firstBoxLine + 1; i < secondComponentLine; i++) {
      if (lines[i]!.trim() === '') blankRun++
    }
    // Before the fix, componentGap=6 produced a run of 6 fully blank rows
    // for this exact diagram. A visual break is still expected, but not a
    // gutter that dwarfs the content itself.
    expect(blankRun).toBeLessThanOrEqual(3)

    // Sanity: both components still render in full.
    expect(ascii).toContain('CUSTOMER')
    expect(ascii).toContain('ORDER')
    expect(ascii).toContain('PRODUCT')
    expect(ascii).toContain('LINE_ITEM')
  })
})

describe('chooseFreeRow / isRowFree (unit)', () => {
  // renderErAscii's fixed vGap=4 only ever produces a 2-row-wide candidate
  // interval, so the geometric midpoint is always the interval's first
  // (topmost) row — the "scan upward" half of chooseFreeRow's search can
  // never find a free row through the full render pipeline alone. These
  // tests exercise that logic directly against a wider, constructed range.

  it('returns the geometric midpoint when it is free', () => {
    const canvas = mkCanvas(20, 20)
    expect(chooseFreeRow(canvas, 0, 6, 0, 10, -1)).toBe(3)
  })

  it('scans downward when the midpoint is occupied', () => {
    const canvas = mkCanvas(20, 20)
    occupyRow(canvas, 3, 0, 10) // midpoint occupied
    expect(chooseFreeRow(canvas, 0, 6, 0, 10, -1)).toBe(4)
  })

  it('scans upward when the midpoint and every row below it are occupied', () => {
    const canvas = mkCanvas(20, 20)
    occupyRow(canvas, 3, 0, 10) // midpoint
    occupyRow(canvas, 4, 0, 10) // one below
    // row 2 (one above the midpoint) stays free
    expect(chooseFreeRow(canvas, 0, 6, 0, 10, -1)).toBe(2)
  })

  it('falls back to the geometric midpoint when every candidate row is occupied', () => {
    const canvas = mkCanvas(20, 20)
    for (let y = 1; y <= 5; y++) occupyRow(canvas, y, 0, 10)
    expect(chooseFreeRow(canvas, 0, 6, 0, 10, -1)).toBe(3)
  })

  it('ignores the skipped column when checking occupancy', () => {
    const canvas = mkCanvas(20, 20)
    write(canvas, 5, 3, '#') // only the skipped column is occupied
    expect(isRowFree(canvas, 3, 0, 10, 5)).toBe(true)
    expect(isRowFree(canvas, 3, 0, 10, -1)).toBe(false)
  })
})
