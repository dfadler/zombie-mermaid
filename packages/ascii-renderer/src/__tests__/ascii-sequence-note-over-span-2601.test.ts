/**
 * #2601: `Note over A,B` drew a text-width box between the lifelines. Mermaid
 * 12.3.0 spans it from the first lifeline to the second with a small overhang
 * and centres the text (same shape as the SVG `sequence-note-over-span` fix).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const SRC = (order: string, text: string, block = false): string =>
  `sequenceDiagram
  participant Alice
  participant Bob
  ${block ? 'loop L\n  alt X' : ''}
  Alice->>Bob: hello there friend
  Note over ${order}: ${text}
  ${block ? 'end\n  end' : ''}`

/** Lifeline columns above the note box, the box border columns, its text row. */
function geometry(out: string): {
  lifelines: number[]
  l: number
  r: number
  text: string
} {
  const lines = out.split('\n')
  const textRow = lines.findIndex((s) => /│ +hi +│/.test(s))
  const top = lines[textRow - 1]!
  return {
    lifelines: [...lines[textRow - 2]!].flatMap((c, i) =>
      c === '│' ? [i] : [],
    ),
    l: top.lastIndexOf('┌'),
    r: top.lastIndexOf('┐'),
    text: lines[textRow]!,
  }
}

describe('ASCII sequence Note over A,B spans the lifelines (#2601)', () => {
  for (const order of ['Alice,Bob', 'Bob,Alice']) {
    it(`spans both lifelines, text centred (${order})`, () => {
      const out = renderMermaidASCII(SRC(order, 'hi'))
      const { lifelines, l, r, text } = geometry(out)
      expect(l).toBe(lifelines[0]! - 1)
      expect(r).toBe(lifelines[1]! + 1)
      const inner = text.slice(l + 1, r)
      const left = inner.indexOf('hi')
      expect(Math.abs(left - (inner.length - left - 2))).toBeLessThanOrEqual(1)
    })
  }

  it('widens the gap when the text is wider than the span', () => {
    const long = 'a note much wider than the lifeline distance'
    const out = renderMermaidASCII(SRC('Alice,Bob', long))
    expect(out).toContain(`│ ${long} │`)
    expect(out).toContain(`┌${'─'.repeat(long.length + 2)}┐`)
  })

  it('stays inside nested block walls', () => {
    const out = renderMermaidASCII(SRC('Alice,Bob', 'hi', true))
    for (const line of out
      .split('\n')
      .filter((s) => s.includes('hi') && !s.includes('hello'))) {
      expect(line.startsWith('│ │')).toBe(true)
      expect(line.trimEnd().endsWith('│ │')).toBe(true)
    }
  })
})
