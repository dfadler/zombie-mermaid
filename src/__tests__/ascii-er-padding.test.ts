// ============================================================================
// ASCII ER diagram padding tests (issue #343)
//
// `-x`/`-y`/`-p` (AsciiRenderOptions.paddingX/paddingY/boxBorderPadding)
// previously only affected the flowchart/state grid layout — ER diagrams
// ignored them entirely (hGap/vGap/componentGap were fixed constants, and
// drawMultiBox was always called with its implicit default padding). This
// file verifies the fix, and that a render with no explicit padding option
// still renders byte-for-byte identical to before the fix (see the
// DEFAULT_PADDING_* comment in src/ascii/types.ts for why that matters).
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

// A single relationship with a short label — exercises the horizontal gap
// between entities without the label itself becoming the binding constraint
// (a long label widens the gap independently of hGap — see the
// `pairLabelWidth` widening in er-diagram.ts — which would make the
// hGap-driven shift non-linear across padding values).
const RELATED = `erDiagram
  CUSTOMER ||--o{ ORDER : x`

// Two disconnected entities — exercises componentGap (vertical stacking).
const DISCONNECTED = `erDiagram
  CUSTOMER {
    string name
  }
  ORDER {
    string id
  }`

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

describe('ASCII ER diagrams — padding (issue #343)', () => {
  it('renders identically with no padding options and with explicit defaults', () => {
    const withoutOptions = renderMermaidASCII(RELATED, { useAscii: true })
    const withDefaults = renderMermaidASCII(RELATED, {
      useAscii: true,
      paddingX: 5,
      paddingY: 5,
      boxBorderPadding: 1,
    })
    expect(withDefaults).toBe(withoutOptions)
  })

  it('paddingX widens the gap between related entities', () => {
    const base = renderMermaidASCII(RELATED, { useAscii: true })
    const wide = renderMermaidASCII(RELATED, { useAscii: true, paddingX: 25 })
    const baseCol = colOf(base, 1, '| ORDER |')
    const wideCol = colOf(wide, 1, '| ORDER |')
    expect(wideCol).toBeGreaterThan(baseCol)
    const mid = renderMermaidASCII(RELATED, { useAscii: true, paddingX: 15 })
    const midCol = colOf(mid, 1, '| ORDER |')
    expect(midCol - baseCol).toBe(wideCol - midCol)
  })

  it('a very small paddingX does not shrink the gap below the safe minimum', () => {
    // Unlike sequence/class diagrams, ER's horizontal gap has a floor equal
    // to its own default (6) rather than a smaller generic minimum — a
    // smaller gap lets the crow's-foot markers on each end overlap (see the
    // hGap comment in er-diagram.ts and ascii-padding-edge-cases.test.ts for
    // the regression test), so a very negative paddingX clamps to the same
    // gap as the default rather than tightening further.
    const base = renderMermaidASCII(RELATED, { useAscii: true })
    const tight = renderMermaidASCII(RELATED, {
      useAscii: true,
      paddingX: -10,
    })
    expect(tight).toBe(base)
  })

  it('paddingY widens the gap between disconnected components', () => {
    const base = renderMermaidASCII(DISCONNECTED, { useAscii: true })
    const tall = renderMermaidASCII(DISCONNECTED, {
      useAscii: true,
      paddingY: 25,
    })
    expect(lineCount(tall)).toBeGreaterThan(lineCount(base))
    const mid = renderMermaidASCII(DISCONNECTED, {
      useAscii: true,
      paddingY: 15,
    })
    expect(lineCount(mid) - lineCount(base)).toBe(
      lineCount(tall) - lineCount(mid),
    )
  })

  it('boxBorderPadding widens entity boxes by exactly 2 columns per unit', () => {
    const base = renderMermaidASCII(RELATED, { useAscii: true })
    const padded = renderMermaidASCII(RELATED, {
      useAscii: true,
      boxBorderPadding: 4,
    })
    expect(borderWidth(padded, 0) - borderWidth(base, 0)).toBe(6)
  })
})
