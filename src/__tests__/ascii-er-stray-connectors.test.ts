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
  it('insets only the colliding "one" marker on a horizontal connector, leaving the non-colliding "zero-many" marker flush (Unicode) — issue #413', () => {
    const ascii = renderMermaidASCII(
      `erDiagram
        CUSTOMER ||--o{ ORDER : places`,
      { colorMode: 'none' },
    )
    // #390 briefly made every horizontal marker sit flush against the
    // border to avoid a "─│─" run (line-fill dash, lone "one" tick,
    // line-fill dash) that the #351 fix worried would read as a stray,
    // unexplained connector glyph. Review on #351/#413 found that concern
    // doesn't hold in a real terminal (adjacent monospace glyphs don't
    // visually fuse regardless of spacing), but a *blanket* revert back to
    // inset for every horizontal marker was its own overcorrection: it
    // adds an unrequested gap to markers that were never ambiguous in the
    // first place. "zero-many" ('○╟') doesn't share a glyph with the
    // border ('│') the way "one" ('│') does, so only "one" needs the
    // inset — "zero-many" stays flush, matching #390's original intent for
    // that glyph. This test locks in the per-side, collision-conditional
    // result instead of a uniform one.
    expect(ascii).toContain('CUSTOMER │─│')
    expect(ascii).toContain('○╟│ ORDER')
  })

  it('insets only the colliding "one" marker on a horizontal connector, leaving the non-colliding "zero-many" marker flush (ASCII) — issue #413', () => {
    const ascii = renderMermaidASCII(
      `erDiagram
        CUSTOMER ||--o{ ORDER : places`,
      { colorMode: 'none', useAscii: true },
    )
    // Same per-side reasoning as the Unicode case above, in the ASCII glyph set.
    expect(ascii).toContain('CUSTOMER |-|')
    expect(ascii).toContain('o<| ORDER')
  })

  it('leaves both markers flush on a horizontal connector when neither collides with the border', () => {
    const ascii = renderMermaidASCII(
      `erDiagram
        CUSTOMER }o--o{ ORDER : has`,
      { colorMode: 'none' },
    )
    // Neither "zero-many" marker ('╢○'/'○╟') shares a glyph with the
    // border ('│'), so a blanket inset (the reviewer's original diff,
    // applied uniformly) would add a gap to both sides for no reason.
    // Matches #390's original flush output exactly, since this case was
    // never part of the #413 collision in the first place.
    expect(ascii).toContain('CUSTOMER │╢○')
    expect(ascii).toContain('○╟│ ORDER')
    expect(ascii).not.toContain('CUSTOMER │─')
    expect(ascii).not.toContain('─│ ORDER')
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

  // The tests above only exercise the "one"/"zero-many" glyphs (`│`, `○╟`).
  // Review on #351 (https://github.com/dfadler/zombie-mermaid/issues/351#issuecomment-5497209031)
  // re-tested with a different cardinality combination — "zero-or-one"
  // (`│○`/`○│`) — confirming the vertical marker stays flush either way.
  // "zero-or-one" also collides with the border on the horizontal axis
  // (its leading/trailing glyph is the same `│` as the "one" marker), so
  // — unlike "zero-many" above — *both* sides of a `C |o--|| D` connector
  // get the inset, not just one. These two tests lock in that finding
  // directly rather than leaving it as a PR-description claim with no
  // regression coverage.

  it('insets the "zero-or-one" marker from the entity border on a horizontal connector, since it collides on both sides — issue #413', () => {
    const ascii = renderMermaidASCII(
      `erDiagram
        C |o--|| D : owns`,
      { colorMode: 'none' },
    )
    // Matches the reviewer's own quoted "main" (pre-#390) output exactly:
    // "C │─│○─│─│ D" — a fill dash separates each entity's border from its
    // own marker on both sides of the connector.
    expect(ascii).toContain('C │─│○')
    expect(ascii).toContain('─│─│ D')
  })

  it('does not leave a stray fill row before a vertical "zero-or-one" marker', () => {
    // Forces a vertical connection the same way as the test above (a
    // second entity fills row 1, wrapping the third onto its own row), but
    // with the reviewer's "zero-or-one" cardinality on the vertical
    // relationship instead of "zero-many" — confirming flush placement
    // stays clean on the vertical axis regardless of which marker glyph is
    // involved, unlike the horizontal case immediately above.
    const ascii = renderMermaidASCII(
      `erDiagram
        A ||--o{ B : ab
        A |o--|| C : owns`,
      { colorMode: 'none' },
    )
    const lines = ascii.split('\n')
    // A's own end of the A→C relationship ("│○") must sit on the row
    // immediately after A's box bottom border — not with a leftover blank
    // row still separating it from the border.
    const aBoxBottomIdx = lines.findIndex((l) => l.includes('└───┘ ab'))
    expect(aBoxBottomIdx).toBeGreaterThan(-1)
    const markerLine = lines[aBoxBottomIdx + 1]
    expect(markerLine).toBeDefined()
    expect(markerLine).toContain('│○')
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

  it('does not let a jog row collide with a label whose span falls outside the jog range (CodeRabbit review, PR #390)', () => {
    // A relationship's label is always drawn to the right of the upper
    // entity's own center column, regardless of which way its jog goes —
    // for a leftward jog (or a short rightward one) that label span sits
    // outside [lx, rx], the range renderErAscii originally checked for
    // occupancy before choosing a jog row. Found by a differential search
    // over random small diagrams comparing the old (narrow) and fixed
    // (label-span-widened) occupancy ranges; this is the minimal case that
    // reproduces it deterministically — DDDD--CCC's jog lands on a row
    // that BB--A's own label already used, and without the widened check
    // DDDD--CCC's own label ends up prefixed with a stray "│" bled through
    // from BB--A's vertical stem.
    const ascii = renderMermaidASCII(
      `erDiagram
        DDDD ||--o{ A : x0
        BB ||--o{ A : l1
        DDDD ||--o{ CCC : longerlabelhere2`,
      { colorMode: 'none' },
    )
    const lines = ascii.split('\n')
    const labelLine = lines.find((l) => l.includes('longerlabelhere2'))
    expect(labelLine).toBeDefined()
    const idx = labelLine!.indexOf('longerlabelhere2')
    // The characters immediately before the label must be plain fill dashes,
    // not a stray "│" bled through from an unrelated relationship's
    // vertical stem sharing this row.
    expect(labelLine!.slice(Math.max(0, idx - 3), idx)).not.toContain('│')
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

  // CodeRabbit review on PR #390: a column past the canvas's current width
  // was reported as `undefined` by a plain index and treated as occupied,
  // even though nothing had actually been drawn there yet — a label routinely
  // grows the canvas on write (see increaseSize at the label call sites),
  // so a not-yet-allocated column is "not drawn", not "occupied".
  it('treats a column past the canvas width as free, not occupied', () => {
    const canvas = mkCanvas(5, 5) // columns 0..5 only
    expect(isRowFree(canvas, 2, 0, 10, -1)).toBe(true)
    expect(chooseFreeRow(canvas, 0, 6, 0, 10, -1)).toBe(3) // still the midpoint
  })

  // CodeRabbit review on PR #390: renderErAscii's jog-row selection checked
  // occupancy only across [lx, rx] (the jog's own span), not the
  // relationship's label — which is always drawn to the right of the upper
  // entity's center column, regardless of which way the jog itself goes.
  // For a leftward jog (rx sits at the upper entity's own column), the
  // label span falls entirely outside that checked range.
  it('rejects a midpoint row whose label span (right of the jog range) is occupied', () => {
    const canvas = mkCanvas(30, 20)
    const lineX = 10 // upper entity's center column
    const lowerCX = 4 // lower entity's center column — left of lineX: a leftward jog
    const lx = Math.min(lineX, lowerCX)
    const rx = Math.max(lineX, lowerCX) // === lineX; the label starts past this
    const labelEndX = lineX + 1 + 'some label'.length
    // Nothing occupies [lx, rx] at the midpoint, but the label area
    // (lineX + 2 .. labelEndX) is already occupied by earlier content.
    occupyRow(canvas, 3, lineX + 2, labelEndX)
    // Checking only the jog's own span (the pre-fix behavior) would accept
    // row 3 even though the label that lands there next would collide.
    expect(isRowFree(canvas, 3, lx, rx, lineX)).toBe(true)
    // Widening the checked range to include the label span (the fix) finds
    // the collision and moves to a different row instead.
    const chosen = chooseFreeRow(
      canvas,
      0,
      6,
      lx,
      Math.max(rx, labelEndX),
      lineX,
    )
    expect(chosen).not.toBe(3)
    expect(isRowFree(canvas, chosen, lx, Math.max(rx, labelEndX), lineX)).toBe(
      true,
    )
  })
})
