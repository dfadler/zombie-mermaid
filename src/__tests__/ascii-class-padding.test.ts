// ============================================================================
// ASCII class diagram padding tests (issue #343)
//
// `-x`/`-y`/`-p` (AsciiRenderOptions.paddingX/paddingY/boxBorderPadding)
// previously only affected the flowchart/state grid layout — class diagrams
// ignored them entirely (hGap/vGap were fixed constants, and drawMultiBox
// was always called with its implicit default padding). This file verifies
// the fix, and that a render with no explicit padding option still renders
// byte-for-byte identical to before the fix (see the DEFAULT_PADDING_*
// comment in src/ascii/types.ts for why that matters).
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

// Two independent, same-level classes — exercises the horizontal gap.
const SIDE_BY_SIDE = `classDiagram
  class Foo
  class Bar`

// A parent/child pair — exercises the vertical gap between levels.
const STACKED = `classDiagram
  class Animal
  class Dog
  Animal <|-- Dog`

function colOf(ascii: string, lineIndex: number, needle: string): number {
  const line = ascii.split('\n')[lineIndex]
  if (line === undefined) throw new Error(`no line ${lineIndex}`)
  const idx = line.indexOf(needle)
  if (idx === -1) throw new Error(`"${needle}" not found on line ${lineIndex}`)
  return idx
}

function lineCount(ascii: string): number {
  return ascii.split('\n').filter((l) => l.length > 0).length
}

function borderWidth(ascii: string, lineIndex: number): number {
  const line = ascii.split('\n')[lineIndex]
  const match = line ? /\+-+\+/.exec(line) : null
  if (!match) throw new Error(`no border run on line ${lineIndex}: ${line}`)
  return match[0].length
}

describe('ASCII class diagrams — padding (issue #343)', () => {
  it('renders identically with no padding options and with explicit defaults', () => {
    const withoutOptions = renderMermaidASCII(SIDE_BY_SIDE, {
      useAscii: true,
    })
    const withDefaults = renderMermaidASCII(SIDE_BY_SIDE, {
      useAscii: true,
      paddingX: 5,
      paddingY: 5,
      boxBorderPadding: 1,
    })
    expect(withDefaults).toBe(withoutOptions)
  })

  it('paddingX widens the gap between same-level class boxes', () => {
    const base = renderMermaidASCII(SIDE_BY_SIDE, { useAscii: true })
    const wide = renderMermaidASCII(SIDE_BY_SIDE, {
      useAscii: true,
      paddingX: 25,
    })
    const baseCol = colOf(base, 1, '| Bar |')
    const wideCol = colOf(wide, 1, '| Bar |')
    expect(wideCol).toBeGreaterThan(baseCol)
    const mid = renderMermaidASCII(SIDE_BY_SIDE, {
      useAscii: true,
      paddingX: 15,
    })
    const midCol = colOf(mid, 1, '| Bar |')
    expect(midCol - baseCol).toBe(wideCol - midCol)
  })

  it('a very small paddingX tightens the gap below the default', () => {
    const base = renderMermaidASCII(SIDE_BY_SIDE, { useAscii: true })
    const tight = renderMermaidASCII(SIDE_BY_SIDE, {
      useAscii: true,
      paddingX: -10,
    })
    expect(colOf(tight, 1, '| Bar |')).toBeLessThan(colOf(base, 1, '| Bar |'))
  })

  it('paddingY widens the vertical gap between inheritance levels', () => {
    const base = renderMermaidASCII(STACKED, { useAscii: true })
    const tall = renderMermaidASCII(STACKED, { useAscii: true, paddingY: 25 })
    expect(lineCount(tall)).toBeGreaterThan(lineCount(base))
    const mid = renderMermaidASCII(STACKED, { useAscii: true, paddingY: 15 })
    expect(lineCount(mid) - lineCount(base)).toBe(
      lineCount(tall) - lineCount(mid),
    )
  })

  it('boxBorderPadding widens class boxes by exactly 2 columns per unit', () => {
    const base = renderMermaidASCII(SIDE_BY_SIDE, { useAscii: true })
    const padded = renderMermaidASCII(SIDE_BY_SIDE, {
      useAscii: true,
      boxBorderPadding: 4,
    })
    expect(borderWidth(padded, 0) - borderWidth(base, 0)).toBe(6)
  })
})
