// With wrap on, a word wider than the wrap width in a message, note or
// participant name splits mid-word with a trailing `-` (mermaid 12.3.0
// breakString), and `wrap:` wraps a participant name (#2963).
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (src: string, useAscii = false) =>
  renderMermaidASCII(src, { useAscii })
const INIT = '%%{init: {"sequence": {"wrap": true, "width": 120}}}%%\n'
const W = 'Supercalifragilisticexpialidocious'
const N = 'Pneumonoultramicroscopicsilicovolcanoconiosis'

describe('long word in wrapped sequence text (#2963)', () => {
  it('splits a wrap: message word and keeps the tail words', () => {
    const out = render(
      `sequenceDiagram\n A->>B: wrap: ${W}_and_more_words here`,
    )
    expect(out).not.toContain(W)
    expect(out).toMatch(/Supercalifragilisticexpialido-/)
    expect(out).toContain('here')
    expect(out).not.toContain('wrap:')
  })

  it('splits a wrap: note word', () => {
    const out = render(
      `sequenceDiagram\n A->>B: x\n Note over A: wrap: ${N} is long`,
    )
    expect(out).not.toContain(N)
    expect(out).toMatch(/Pneumonoultramicros-/)
    expect(out).toContain('is long')
  })

  it('wraps a participant name by prefix, growing the box', () => {
    const plain = render(`sequenceDiagram\n participant A as ${W}`)
    const out = render(`sequenceDiagram\n participant A as wrap:${W}`)
    expect(plain).toContain(W)
    expect(out).not.toContain(W)
    expect(out).not.toContain('wrap:')
    expect(out).toMatch(/Supercalifragilisti-/)
    expect(out.split('\n').length).toBeGreaterThan(plain.split('\n').length)
  })

  it('splits all three under init wrap with a custom width', () => {
    const out = render(
      `${INIT}sequenceDiagram\n participant A as ${W}\n A->>B: ${W}_and_more_words here\n Note over A: ${N} is long`,
    )
    for (const w of [W, N]) expect(out).not.toContain(w)
    expect(out).toMatch(/Supercalifragil-/)
    expect(out).toMatch(/Pneumonoultrami-/)
  })

  it('keeps nowrap: whole and works in ASCII charset', () => {
    const out = render(`${INIT}sequenceDiagram\n A->>B: nowrap: ${W}`, true)
    expect(out).toContain(W)
    const split = render(`${INIT}sequenceDiagram\n A->>B: ${W}`, true)
    expect(split).toMatch(/Supercalifragilisticexpia-/)
  })

  it('wraps a short word run after a long word on the same line', () => {
    const out = render(`${INIT}sequenceDiagram\n A->>B: a ${W} b c`)
    expect(out).toMatch(/\ba\b/)
    expect(out).toMatch(/\bb c\b|\bc\b/)
  })
})
