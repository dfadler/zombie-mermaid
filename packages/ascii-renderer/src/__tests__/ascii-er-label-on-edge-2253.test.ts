// ============================================================================
// ASCII ER diagram: a vertical relationship's label sits on its edge (#2253)
//
// mermaid.js (12.1.0 and 12.2.0 alike) draws the label centered on the
// vertical edge, midway between the two entities, interrupting the line.
// The renderer used to print it beside the stem.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const THEIRS = `erDiagram
    INSTALL }o--|| PROJECT : scopes
    INSTALL {
        string scope
        string installPath
    }`

/** [start, end) columns of `text` on the row that holds it. */
const span = (out: string, text: string) => {
  const row = out.split('\n').find((l) => l.includes(text))!
  const start = row.indexOf(text)
  return { row, start, end: start + text.length }
}

describe('ASCII ER label on the edge (issue #2253)', () => {
  for (const [useAscii, v] of [
    [false, '│'],
    [true, '|'],
  ] as const) {
    it(`centers the label on the stem, line broken around it (useAscii=${useAscii})`, () => {
      const out = renderMermaidASCII(THEIRS, { useAscii })
      const lines = out.split('\n')
      const { start, end } = span(out, 'scopes')
      const i = lines.findIndex((l) => l.includes('scopes'))
      // Stem column: where the line runs on the row above the label.
      const stem = lines[i - 1]!.indexOf(v)
      expect(stem).toBeGreaterThanOrEqual(start)
      expect(stem).toBeLessThan(end)
      expect(Math.abs((start + end - 1) / 2 - stem)).toBeLessThanOrEqual(1)
      // The line carries on below it, and nothing else shares the label row.
      expect(lines[i + 1]![stem]).toBe(v)
      expect(lines[i]!.trim()).toBe('scopes')
      // Midway between the two boxes (within a row of the middle).
      const top = lines.findIndex((l) => l.includes('installPath')) + 1
      const bottom = lines.findIndex((l) => l.includes('PROJECT')) - 1
      expect(Math.abs(i - (top + bottom) / 2)).toBeLessThanOrEqual(1.5)
    })
  }

  it('centers a label on each edge of a chain', () => {
    const out = renderMermaidASCII(
      'erDiagram\n  A ||--o{ B : has\n  B ||--o{ C : owns',
    )
    for (const t of ['has', 'owns']) {
      const lines = out.split('\n')
      const i = lines.findIndex((l) => l.includes(t))
      expect(lines[i]!.trim()).toBe(t)
      expect(lines[i - 1]!.trim()).toBe('│')
      expect(lines[i + 1]!.trim()).toBe('│')
    }
  })

  it('keeps a label wider than the room left of the stem over the stem', () => {
    const out = renderMermaidASCII(
      'erDiagram\n  CUSTOMER ||--o{ ORDER : "places a very long relationship label"',
    )
    const lines = out.split('\n')
    const i = lines.findIndex((l) => l.includes('places a very'))
    expect(lines[i - 1]!.trim()).toBe('│')
    expect(lines[i + 1]!.trim()).toBe('│')
  })
})
