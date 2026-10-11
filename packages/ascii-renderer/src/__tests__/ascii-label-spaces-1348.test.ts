/**
 * #1348: a label drawn on a stroke keeps its spaces. `mergeCanvases` treats an
 * overlay's space as transparent, so the stroke under a space showed through
 * and `long label` read `long─label`.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

// `long label` lands on the horizontal stroke leaving A for C.
const ON_STROKE = `graph TD
A -->|x| B
A -->|long label| C
C -->|ab| A`

const render = (src: string, useAscii = false): string =>
  renderMermaidASCII(src, { colorMode: 'none', useAscii })

describe('ASCII label spaces (#1348)', () => {
  it('keeps the space in a label drawn on a stroke', () => {
    const out = render(ON_STROKE)
    expect(out).toContain('long label')
    expect(out).not.toMatch(/long[─│]label/)
  })

  it('does the same in ASCII mode', () => {
    const out = render(ON_STROKE, true)
    expect(out).toContain('long label')
    expect(out).not.toMatch(/long[-|]label/)
  })

  it('keeps every interior space of a longer label', () => {
    const out = render(`graph TD
A -->|one two three| B
B --> C
A --> C`)
    expect(out).toContain('one two three')
  })

  it('does not blank a cell outside the label text', () => {
    // Only spaces between the label's first and last glyph are forced; a
    // stroke next to the label must stay.
    const out = render(`graph TD\nA -->|a b| B`)
    expect(out).toContain('a b')
    expect(out).toContain('▼')
  })
})
