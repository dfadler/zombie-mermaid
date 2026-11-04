/**
 * #2514: a block's wall was sized from lifeline positions only, so a note box
 * inside a `loop`/`alt`/`opt` ran past it. Mermaid 12.2.0 draws the block
 * around its notes (loopLine right edge 533 vs note right edge 523 for the
 * issue source), and so does the ASCII wall now.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

const T = 'waits for the upstream response'
const SRC = (block: string, note: string): string => `sequenceDiagram
  participant A
  participant B
  participant C
  ${block}
    A->>B: fetch
    ${note}
  end`

const ISSUE = `sequenceDiagram
  participant A
  participant B
  loop every retry
    A->>B: fetch
    Note right of B: ${T}
  end`

/** Block wall columns (closing row) and the note box border columns. */
function wall(out: string): {
  l: number
  r: number
  noteL: number
  noteR: number
} {
  const lines = out.split('\n')
  const bottom = lines.find((l) => /^ *└─+┘/.test(l))!
  const at = lines.find((l) => l.includes(T))!.indexOf(T)
  return {
    l: bottom.indexOf('└'),
    r: bottom.lastIndexOf('┘'),
    noteL: at - 2,
    noteR: at + T.length + 1,
  }
}

describe('ASCII sequence block walls enclose notes (#2514)', () => {
  for (const block of ['loop retry', 'alt ok', 'opt maybe']) {
    for (const note of [
      `Note right of B: ${T}`,
      `Note left of A: ${T}`,
      `Note over A,B: ${T}`,
      `Note over A: ${T}`,
    ]) {
      it(`${block} / ${note.slice(0, 16)}`, () => {
        const out = renderMermaidASCII(SRC(block, note))
        const w = wall(out)
        // The note text sits strictly between the walls, as does its border.
        // with one blank column between each wall and the note border.
        expect(w.noteL).toBeGreaterThanOrEqual(w.l + 2)
        expect(w.noteR).toBeLessThanOrEqual(w.r - 2)
      })
    }
  }

  it('keeps the [else] divider as wide as the wall', () => {
    const out = renderMermaidASCII(`sequenceDiagram
  participant A
  participant B
  alt ok
    A->>B: x
    Note right of B: ${T}
  else bad
    B->>A: y
  end`)
    const rows = out.split('\n')
    const div = rows.find((l) => l.startsWith('├'))!
    const bottom = rows.find((l) => l.startsWith('└'))!
    expect(div.trimEnd().length).toBe(bottom.trimEnd().length)
  })

  it('keeps every nested left wall clear of a left note on the first actor', () => {
    const out = renderMermaidASCII(`sequenceDiagram
  participant A
  participant B
  loop one
    loop two
      loop three
        A->>B: x
        Note left of A: hello there
      end
    end
  end`)
    const row = out.split('\n').find((l) => l.includes('hello there'))!
    // Three walls one blank column apart, a blank column, the note border.
    expect(row.startsWith('│ │ │ │ hello there │')).toBe(true)
  })

  it('leaves a clear column between a note wall and an uninvolved lifeline', () => {
    const out = renderMermaidASCII(`sequenceDiagram
  participant A
  participant B
  participant C
  loop x
    A->>B: hi
    Note right of B: a fairly wide note beside B here
  end
  C->>A: z`)
    const row = out.split('\n').find((l) => l.includes('a fairly wide note'))!
    // Note border, blank, wall, blank, then C's lifeline.
    expect(/│ │ │ *$/.test(row)).toBe(true)
  })

  it('reserves a row for every line of a multi-line block label', () => {
    const out = renderMermaidASCII(`sequenceDiagram
  participant A
  participant B
  loop one<br/>two<br/>three
    A->>B: abcdefghijklmnop
  end`)
    const msg = out.split('\n').find((l) => l.includes('abcdefghijklmnop'))!
    expect(msg).not.toContain('three')
  })

  it('snapshots ASCII and SVG for the issue source', () => {
    expect(renderMermaidASCII(ISSUE)).toMatchSnapshot('ascii')
    expect(renderMermaidSVG(ISSUE)).toMatchSnapshot('svg')
  })
})
