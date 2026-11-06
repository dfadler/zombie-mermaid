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

  // Each source checked against mermaid 12.3.0: the note rect starts below the
  // block's loopLine bottom (frame bottom y=175 / note y=185 for the single
  // block cases).
  const H = 'sequenceDiagram\n  participant A\n  participant B\n'
  const AFTER: Array<[string, string, string]> = [
    [
      'left of',
      `${H}  loop x\n    A->>B: m\n  end\n  Note left of A: nn`,
      'loop',
    ],
    [
      'right of',
      `${H}  opt x\n    A->>B: m\n  end\n  Note right of B: nn`,
      'opt',
    ],
    [
      'par',
      `${H}  par p\n    A->>B: m\n  and q\n    B->>A: k\n  end\n  Note over A: nn`,
      'par',
    ],
    [
      'critical',
      `${H}  critical c\n    A->>B: m\n  option o\n    B->>A: k\n  end\n  Note over A,B: nn`,
      'critical',
    ],
    ['break', `${H}  break b\n    A->>B: m\n  end\n  Note over B: nn`, 'break'],
    [
      'else section',
      `${H}  alt a\n    A->>B: m\n  else b\n    B->>A: k\n    Note over A: in else\n  end\n  Note over B: nn`,
      'alt',
    ],
  ]
  for (const [name, src, header] of AFTER) {
    it(`draws a ${name} note below the closed frame`, () => {
      const out = renderMermaidASCII(src)
      expect(rowOf(out, 'nn')).toBeGreaterThan(frameBottom(out, header))
    })
  }

  it('keeps two notes after one end in order below the frame', () => {
    const out = renderMermaidASCII(
      `${H}  opt x\n    A->>B: m\n  end\n  Note over A: one\n  Note over B: two`,
    )
    expect(rowOf(out, 'one')).toBeGreaterThan(frameBottom(out, 'opt'))
    expect(rowOf(out, 'two')).toBeGreaterThan(rowOf(out, 'one'))
  })

  it('keeps a note inside the else section it was written in', () => {
    const out = renderMermaidASCII(AFTER[5]![1])
    expect(rowOf(out, 'in else')).toBeGreaterThan(rowOf(out, '[b]'))
    expect(rowOf(out, 'in else')).toBeLessThan(frameBottom(out, 'alt'))
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
