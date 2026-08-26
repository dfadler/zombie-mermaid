// ============================================================================
// ASCII sequence diagram — self-arrow regression tests (issue #68)
//
// Two bugs in the ASCII sequence-diagram renderer's handling of self-arrows
// (A->>A: ...):
//   1. <br/> in a self-arrow label wrote the raw string (with an embedded
//      newline) onto a single canvas row instead of splitting it onto
//      multiple rows, corrupting every column to the right for the rest of
//      the diagram.
//   2. A self-arrow inside an alt/loop/opt block could be drawn outside the
//      block's wall because the wall's width was computed from lifeline
//      positions only, ignoring the self-arrow's loop glyphs and label.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

describe('ASCII sequence diagrams – self-arrow labels (issue #68)', () => {
  it('splits <br/> in a self-arrow label across rows without corrupting the canvas', () => {
    const result = renderMermaidASCII(
      `
sequenceDiagram
  participant A
  participant B
  A->>A: line one<br/>line two
`,
      { useAscii: false },
    )

    const lines = result.split('\n')
    const line1Idx = lines.findIndex((l) => l.includes('line one'))
    const line2Idx = lines.findIndex((l) => l.includes('line two'))

    expect(line1Idx).toBeGreaterThan(-1)
    expect(line2Idx).toBeGreaterThan(-1)
    // Each line of the label gets its own row, immediately below the last.
    expect(line2Idx).toBe(line1Idx + 1)

    // A corrupted canvas dumps the raw "line one\nline two" string onto one
    // cell: the terminal newline forces "line two" to print flush against
    // column 0 (no box-drawing indentation) instead of as a properly
    // positioned canvas row.
    expect(lines[line2Idx]!.startsWith(' ')).toBe(true)

    // B's lifeline must still be intact on both label rows — a corrupted
    // canvas shifts every column right of the embedded newline down one
    // row for the rest of the diagram, destroying the B column.
    expect(lines[line1Idx]).toContain('│')
    expect(lines[line2Idx]).toContain('│')

    // The footer actor boxes must render correctly and stay aligned with
    // the header boxes (proves later rows weren't shifted by the newline).
    const bottomBorders = (result.match(/└───┘/g) || []).length
    expect(bottomBorders).toBe(2) // one footer box per actor (A, B)
  })

  it('handles 3+ line self-arrow labels', () => {
    const result = renderMermaidASCII(
      `
sequenceDiagram
  participant A
  A->>A: one<br/>two<br/>three
`,
      { useAscii: false },
    )
    const lines = result.split('\n')
    const idxOne = lines.findIndex((l) => l.includes('one'))
    const idxTwo = lines.findIndex((l) => l.includes('two'))
    const idxThree = lines.findIndex((l) => l.includes('three'))
    expect(idxTwo).toBe(idxOne + 1)
    expect(idxThree).toBe(idxTwo + 1)
  })

  it("extends an alt block's wall past a self-arrow's loop and label", () => {
    const result = renderMermaidASCII(
      `
sequenceDiagram
  participant A
  participant B
  alt some condition
    A->>A: a fairly long self-arrow label here
  end
`,
      { useAscii: false },
    )

    // The block header label must not be clipped by an undersized wall.
    expect(result).toContain('alt [some condition]')

    // The self-arrow's loop corners must stay intact — a wall drawn too
    // far left overwrites them with the wall's vertical-bar character.
    expect(result).toContain('├───┐')
    expect(result).toContain('◀───┘')

    // The label and the block's right wall must coexist on the same row,
    // with the wall to the right of (not through) the label.
    const labelLine = result
      .split('\n')
      .find((l) => l.includes('a fairly long self-arrow label here'))
    expect(labelLine).toBeDefined()
    expect(labelLine!.trimEnd().endsWith('│')).toBe(true)
  })

  it("extends a loop block's wall past a self-arrow's loop and label", () => {
    const result = renderMermaidASCII(
      `
sequenceDiagram
  participant A
  loop every request
    A->>A: a fairly long self-arrow label for the loop block
  end
`,
      { useAscii: false },
    )

    expect(result).toContain('loop [every request]')
    expect(result).toContain('├───┐')
    expect(result).toContain('◀───┘')

    const labelLine = result
      .split('\n')
      .find((l) =>
        l.includes('a fairly long self-arrow label for the loop block'),
      )
    expect(labelLine).toBeDefined()
    expect(labelLine!.trimEnd().endsWith('│')).toBe(true)
  })
})
