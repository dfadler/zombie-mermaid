/**
 * Regression tests for #418 ("All Edge Styles"): an edge whose route fell
 * through to determinePath's Case-4 direct fallback has a single diagonal
 * path segment. draw-lines.ts draws that segment as an L (horizontal-first),
 * but determineLabelLine used to center the label on the diagonal itself —
 * mid-way between the two drawn legs, in open grid next to some *other*
 * edge's connector. The `thick` label ended up abutting the dotted edge's
 * column (`┆thick`) instead of sitting on its own `┃` line.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'
import { expandDiagonalSegments } from '../ascii/edge-routing.ts'

const ALL_EDGE_STYLES = `graph TD
  A[Source] -->|solid| B[Target 1]
  A -.->|dotted| C[Target 2]
  A ==>|thick| D[Target 3]`

describe('expandDiagonalSegments', () => {
  it('leaves an axis-aligned path untouched', () => {
    const path = [
      { x: 1, y: 1 },
      { x: 1, y: 4 },
      { x: 5, y: 4 },
    ]
    expect(expandDiagonalSegments(path)).toEqual(path)
  })

  it('splits a diagonal step at its horizontal-first corner', () => {
    expect(
      expandDiagonalSegments([
        { x: 2, y: 1 },
        { x: 9, y: 4 },
      ]),
    ).toEqual([
      { x: 2, y: 1 },
      { x: 9, y: 1 },
      { x: 9, y: 4 },
    ])
  })

  it('handles a diagonal step in the middle of a longer path', () => {
    expect(
      expandDiagonalSegments([
        { x: 0, y: 0 },
        { x: 0, y: 2 },
        { x: 3, y: 5 },
        { x: 3, y: 7 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 5 },
      { x: 3, y: 7 },
    ])
  })
})

describe('edge label on a Case-4 direct-fallback (diagonal) path', () => {
  const lines = renderMermaidASCII(ALL_EDGE_STYLES, { colorMode: 'none' })
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))

  const labelRowIndex = lines.findIndex((l) => l.includes('thick'))
  const labelRow = lines[labelRowIndex]!
  const labelStart = labelRow.indexOf('thick')
  const labelEnd = labelStart + 'thick'.length - 1

  it('is not glued to an unrelated edge’s connector', () => {
    expect(labelRow).not.toMatch(/[┆┊│]thick|thick[┆┊│]/)
  })

  it('sits on the thick edge’s own vertical line', () => {
    // The thick edge's vertical run (┃) is drawn in the rows right above
    // and below the label; the label must be centered on that column, not
    // floating somewhere between its own connector and a neighbour's.
    const above = lines[labelRowIndex - 1]!
    const below = lines[labelRowIndex + 1]!
    const thickColumnAbove = above.indexOf('┃')
    const thickColumnBelow = below.indexOf('┃')
    expect(thickColumnAbove).toBeGreaterThan(-1)
    expect(thickColumnBelow).toBe(thickColumnAbove)
    expect(thickColumnAbove).toBeGreaterThanOrEqual(labelStart)
    expect(thickColumnAbove).toBeLessThanOrEqual(labelEnd)
  })

  it('keeps the dotted label on the dotted column', () => {
    const dottedRow = lines.find((l) => l.includes('dotted'))!
    const dottedStart = dottedRow.indexOf('dotted')
    const dottedColumn = lines[lines.indexOf(dottedRow) + 1]!.indexOf('┆')
    expect(dottedColumn).toBeGreaterThanOrEqual(dottedStart)
    expect(dottedColumn).toBeLessThanOrEqual(dottedStart + 'dotted'.length - 1)
  })
})
