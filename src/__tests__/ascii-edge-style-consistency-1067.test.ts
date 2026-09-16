/**
 * Regression test for #1067 ("All Edge Styles" form-judge finding): a
 * same-source fan-out with three distinct edge styles (`-->`, `-.->`,
 * `==>`) could render one edge's own line as a mix of two different
 * styles — e.g. the dotted `A -.-> C` edge's horizontal leg drawing as
 * heavy box-drawing characters (borrowed from the thick `A ==> D` edge's
 * overlapping route) before switching to its own dashed vertical leg.
 *
 * Root cause: `A ==> D`'s route fell through to `determinePath`'s Case-4
 * direct fallback (edge-routing.ts), which used to hand back a raw
 * two-point diagonal segment (`[prefFrom, prefTo]`) instead of the
 * axis-aligned corner `drawLine` (draw-lines.ts) actually draws for it.
 * That mismatch meant `edge-cell-styles.ts`'s cross-style conflict
 * detection — which walks `edge.path` assuming it already matches the
 * drawn geometry — never saw the real overlap with the dotted edge's own
 * (properly routed) horizontal leg, so nothing rerouted around it and the
 * later-drawn thick edge's canvas simply overwrote the dotted edge's
 * glyphs where the two coincided.
 *
 * Two changes fix it:
 *  - `determinePath`'s Case-4 fallback now runs its diagonal segment
 *    through `expandDiagonalSegments` before assigning `edge.path`, so the
 *    recorded path always matches what `drawLine` actually draws.
 *  - `canvas.ts`'s `firstClaimWins` resolves any leftover overlap between
 *    edges' own line canvases before they're merged: whichever edge's line
 *    reaches a cell first (by `graph.edges` order) keeps it, instead of
 *    `mergeCanvases`' normal last-overlay-wins behavior silently splicing
 *    a later sibling's style into an earlier edge's own line.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const ALL_EDGE_STYLES = `graph TD
  A[Source] -->|solid| B[Target 1]
  A -.->|dotted| C[Target 2]
  A ==>|thick| D[Target 3]`

const HEAVY_CHARS = /[━┃]/
const DASHED_CHARS = /[┄┆]/

describe('edge line style consistency on a same-source mixed-style fan-out (#1067)', () => {
  const lines = renderMermaidASCII(ALL_EDGE_STYLES, { colorMode: 'none' })
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))

  it('renders every label and does not throw', () => {
    const out = lines.join('\n')
    for (const label of ['Source', 'Target 1', 'Target 2', 'Target 3']) {
      expect(out).toContain(label)
    }
  })

  it("keeps the dotted edge's own horizontal leg entirely dashed, never heavy", () => {
    const sourceRow = lines.find((l) => l.includes('Source'))!
    const afterBoxStart = sourceRow.slice(sourceRow.indexOf('├') + 1)
    // The dotted edge's own corner is the *first* turn ('┐') on this row —
    // the thick edge's route continues past it to a second, later corner.
    const dottedCornerIndex = afterBoxStart.indexOf('┐')
    expect(dottedCornerIndex).toBeGreaterThan(-1)
    const dottedSegment = afterBoxStart.slice(0, dottedCornerIndex + 1)

    expect(dottedSegment).not.toMatch(HEAVY_CHARS)
    expect(dottedSegment).toMatch(DASHED_CHARS)
  })

  it("keeps the dotted edge's own vertical leg entirely dashed", () => {
    const dottedLabelRow = lines.findIndex((l) => l.includes('dotted'))
    expect(dottedLabelRow).toBeGreaterThan(-1)
    // The vertical run is drawn on the rows immediately above and below
    // the label.
    for (const row of [
      lines[dottedLabelRow - 1]!,
      lines[dottedLabelRow + 1]!,
    ]) {
      const col = row.indexOf('┆')
      expect(col).toBeGreaterThan(-1)
      expect(row[col + 1] ?? '').not.toMatch(HEAVY_CHARS)
    }
  })

  it("keeps the thick edge's own vertical leg entirely heavy, never dashed", () => {
    const thickLabelRow = lines.findIndex((l) => l.includes('thick'))
    expect(thickLabelRow).toBeGreaterThan(-1)
    for (const row of [lines[thickLabelRow - 1]!, lines[thickLabelRow + 1]!]) {
      const col = row.indexOf('┃')
      expect(col).toBeGreaterThan(-1)
    }
  })
})
