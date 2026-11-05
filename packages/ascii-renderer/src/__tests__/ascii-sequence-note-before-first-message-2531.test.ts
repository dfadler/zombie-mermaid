/**
 * #2531: a note written between a block's header and its first message was
 * drawn above the header, outside the wall. Mermaid 12.2.0 places it inside
 * the block (loopLine top y=130, note rect y=175, first message y=229 for the
 * issue source), and so does the ASCII renderer now.
 */
// Provenance (#2679): the .snap is this renderer's own output, accepted once when the test was written. It does not claim to match mermaid.js.
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

const ISSUE = `sequenceDiagram
  participant A
  participant B
  A->>B: first
  loop retry
    Note right of B: before the first message
    A->>B: fetch
  end`

const NESTED = `sequenceDiagram
  participant A
  participant B
  loop outer
    Note over A: outer note
    opt inner
      Note over B: inner note
      A->>B: go
    end
  end`

const FIRST = `sequenceDiagram
  participant A
  participant B
  alt ok
    Note left of A: no message yet
    A->>B: go
  else bad
    B->>A: back
  end`

function rowOf(out: string, text: string): number {
  return out.split('\n').findIndex((l) => l.includes(text))
}

describe('ASCII sequence note before a block first message (#2531)', () => {
  it('draws the note under the block header', () => {
    const out = renderMermaidASCII(ISSUE)
    expect(rowOf(out, 'loop')).toBeLessThan(rowOf(out, 'before the first'))
    expect(rowOf(out, 'before the first')).toBeLessThan(rowOf(out, 'fetch'))
    // Inside the wall, not floating beside it.
    expect(out.split('\n')[rowOf(out, 'before the first')]).toMatch(/^│.*│$/)
  })

  it('places each note under the innermost header that contains it', () => {
    const out = renderMermaidASCII(NESTED)
    const r = (t: string): number => rowOf(out, t)
    expect(r('outer]')).toBeLessThan(r('outer note'))
    expect(r('outer note')).toBeLessThan(r('inner]'))
    expect(r('inner]')).toBeLessThan(r('inner note'))
    expect(r('inner note')).toBeLessThan(r('go'))
  })

  it('works when no message precedes the block', () => {
    const out = renderMermaidASCII(FIRST)
    expect(rowOf(out, 'alt')).toBeLessThan(rowOf(out, 'no message yet'))
    expect(rowOf(out, 'no message yet')).toBeLessThan(rowOf(out, 'go'))
  })

  it('keeps a note before the block header outside the block', () => {
    const out = renderMermaidASCII(`sequenceDiagram
  participant A
  participant B
  Note over A: outside
  loop x
    A->>B: go
  end`)
    expect(rowOf(out, 'outside')).toBeLessThan(rowOf(out, 'loop'))
  })

  for (const [name, src] of [
    ['issue', ISSUE],
    ['nested', NESTED],
    ['first', FIRST],
  ] as const) {
    it(`snapshots ASCII and SVG for ${name}`, () => {
      expect(renderMermaidASCII(src)).toMatchSnapshot('ascii')
      expect(renderMermaidSVG(src)).toMatchSnapshot('svg')
    })
  }
})
