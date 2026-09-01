// ============================================================================
// ASCII sequence diagram padding tests (issue #343)
//
// `-x`/`-y`/`-p` (AsciiRenderOptions.paddingX/paddingY/boxBorderPadding)
// previously only affected the flowchart/state grid layout — sequence
// diagrams ignored them entirely and always used fixed internal spacing
// constants. This file verifies the fix: padding now visibly widens/
// tightens lifeline spacing, actor-box size, and vertical row spacing,
// while a render with no explicit padding option still renders byte-for-
// byte identical to before the fix (see the DEFAULT_PADDING_* comment in
// src/ascii/types.ts for why that matters).
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

const SEQ = `sequenceDiagram
  participant A
  participant B
  A->>B: Hi`

/** Column index of the first occurrence of `needle` on a given line. */
function colOf(ascii: string, lineIndex: number, needle: string): number {
  const line = ascii.split('\n')[lineIndex]
  if (line === undefined) throw new Error(`no line ${lineIndex}`)
  const idx = line.indexOf(needle)
  if (idx === -1) throw new Error(`"${needle}" not found on line ${lineIndex}`)
  return idx
}

/** Width (in chars) of the first `+---+`-style border run on a line. */
function borderWidth(ascii: string, lineIndex: number): number {
  const line = ascii.split('\n')[lineIndex]
  if (line === undefined) throw new Error(`no line ${lineIndex}`)
  const match = /\+-+\+/.exec(line)
  if (!match) throw new Error(`no border run on line ${lineIndex}: ${line}`)
  return match[0].length
}

function lineCount(ascii: string): number {
  return ascii.split('\n').filter((l) => l.length > 0).length
}

describe('ASCII sequence diagrams — padding (issue #343)', () => {
  it('renders identically with no padding options and with explicit defaults', () => {
    const withoutOptions = renderMermaidASCII(SEQ, { useAscii: true })
    const withDefaults = renderMermaidASCII(SEQ, {
      useAscii: true,
      paddingX: 5,
      paddingY: 5,
      boxBorderPadding: 1,
    })
    expect(withDefaults).toBe(withoutOptions)
  })

  it('paddingX widens the gap between lifelines (actor B shifts right)', () => {
    const base = renderMermaidASCII(SEQ, { useAscii: true })
    const wide = renderMermaidASCII(SEQ, { useAscii: true, paddingX: 25 })
    const baseCol = colOf(base, 1, '| B |')
    const wideCol = colOf(wide, 1, '| B |')
    expect(wideCol).toBeGreaterThan(baseCol)
    // Two independent step sizes from two different starting points produce
    // the same shift — demonstrates paddingX scales lifeline spacing
    // linearly rather than just "doing something" once.
    const mid = renderMermaidASCII(SEQ, { useAscii: true, paddingX: 15 })
    const midCol = colOf(mid, 1, '| B |')
    expect(midCol - baseCol).toBe(wideCol - midCol)
  })

  it('a very small paddingX tightens lifeline spacing below the default', () => {
    const base = renderMermaidASCII(SEQ, { useAscii: true })
    const tight = renderMermaidASCII(SEQ, { useAscii: true, paddingX: -10 })
    expect(colOf(tight, 1, '| B |')).toBeLessThan(colOf(base, 1, '| B |'))
  })

  it('paddingY adds extra blank rows (taller diagram)', () => {
    const base = renderMermaidASCII(SEQ, { useAscii: true })
    const tall = renderMermaidASCII(SEQ, { useAscii: true, paddingY: 25 })
    expect(lineCount(tall)).toBeGreaterThan(lineCount(base))
    // Same linearity check as paddingX above.
    const mid = renderMermaidASCII(SEQ, { useAscii: true, paddingY: 15 })
    expect(lineCount(mid) - lineCount(base)).toBe(
      lineCount(tall) - lineCount(mid),
    )
  })

  it('boxBorderPadding widens actor boxes by exactly 2 columns per unit', () => {
    const base = renderMermaidASCII(SEQ, { useAscii: true })
    const padded = renderMermaidASCII(SEQ, {
      useAscii: true,
      boxBorderPadding: 4,
    })
    // boxWidth = labelWidth + 2*boxBorderPadding + 2 (border chars) — going
    // from the default (1) to 4 adds 2*(4-1) = 6 columns to each actor box.
    expect(borderWidth(padded, 0) - borderWidth(base, 0)).toBe(6)
  })

  it('boxBorderPadding also widens note boxes and shifts note content', () => {
    const withNote = `sequenceDiagram
      participant A
      Note over A: hello`
    const base = renderMermaidASCII(withNote, { useAscii: true })
    const padded = renderMermaidASCII(withNote, {
      useAscii: true,
      boxBorderPadding: 4,
    })
    // The note's own top border is the second '+---+' run rendered (the
    // first belongs to the actor header box), so isolate it before
    // comparing width.
    const noteBorder = (ascii: string) => {
      const line = ascii.split('\n')[4] // note top border row
      const match = line ? /\+-+\+/.exec(line) : null
      if (!match) throw new Error(`no note border found: ${line}`)
      return match[0].length
    }
    expect(noteBorder(padded) - noteBorder(base)).toBe(6)
    expect(colOf(padded, 5, 'hello')).toBeGreaterThan(colOf(base, 5, 'hello'))
  })
})
