/**
 * #2744: a note written after a block's `end` was drawn inside that block's
 * frame. Mermaid 12.3.0 closes the frame at `end` and draws the note below it
 * (the SVG renderer already agrees).
 */
// Provenance (#2679): the .snap is this renderer's own output, accepted once when the test was written. Placement checked against mermaid 12.3.0 per #2744.
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

const ISSUE = `sequenceDiagram
  participant A
  participant B
  opt warm up
    B->>B: rebuild
  end
  Note over A,B: done`

const SIDE = `sequenceDiagram
  participant A
  participant B
  loop retry
    A->>B: fetch
  end
  Note right of B: after`

// The note follows the inner `end` but is still inside the outer block.
const NESTED = `sequenceDiagram
  participant A
  participant B
  alt ok
    opt inner
      A->>B: go
    end
    Note over A,B: between
  else bad
    B->>A: back
  end
  Note over B: last`

// Written before `end`: stays inside.
const INSIDE = `sequenceDiagram
  participant A
  participant B
  opt x
    A->>B: go
    Note over A,B: inside
  end`

function rowOf(out: string, text: string): number {
  return out.split('\n').findIndex((l) => l.includes(text))
}

// A frame's bottom wall is the first `└──…┘` row below the header.
function frameBottom(out: string, header: string): number {
  const lines = out.split('\n')
  for (let i = rowOf(out, header); i < lines.length; i++) {
    if (/└─{4,}┘/.test(lines[i]!)) return i
  }
  return -1
}

describe('ASCII sequence note after a block end (#2744)', () => {
  it('draws the note below the closed frame', () => {
    for (const [src, header, note] of [
      [ISSUE, 'opt', 'done'],
      [SIDE, 'loop', 'after'],
    ] as const) {
      const out = renderMermaidASCII(src)
      expect(rowOf(out, note)).toBeGreaterThan(frameBottom(out, header))
    }
  })

  it('keeps a note inside the inner block outer frame but outside the inner', () => {
    const out = renderMermaidASCII(NESTED)
    expect(rowOf(out, 'between')).toBeGreaterThan(frameBottom(out, 'opt'))
    expect(rowOf(out, 'between')).toBeLessThan(rowOf(out, '[bad]'))
    expect(rowOf(out, 'last')).toBeGreaterThan(rowOf(out, 'back'))
  })

  it('keeps a note written before the end inside the frame', () => {
    const out = renderMermaidASCII(INSIDE)
    expect(rowOf(out, 'inside')).toBeLessThan(frameBottom(out, 'opt'))
  })

  for (const [name, src] of [
    ['issue', ISSUE],
    ['side', SIDE],
    ['nested', NESTED],
    ['inside', INSIDE],
  ] as const) {
    it(`snapshots ASCII and SVG for ${name}`, () => {
      expect(renderMermaidASCII(src)).toMatchSnapshot('ascii')
      expect(renderMermaidSVG(src)).toMatchSnapshot('svg')
    })
  }
})
