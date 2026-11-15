// A wrapped message wraps at the lifeline gap its own first wrap sized
// (mermaid@12.3.0 wraps twice), so line counts match mermaid's (#3197).
// Expected counts measured with scripts/lib/real-mermaid.ts.
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const N = 'Pneumonoultramicroscopicsilicovolcanoconiosis'
// Rows between the participant boxes that carry message text.
const textRows = (out: string) =>
  out
    .split('\n')
    .filter((l) => /[A-Za-z]{3}/.test(l) && !/[│|] *[AB] *[│|]/.test(l)).length

describe('wrapped message width (#3197)', () => {
  // [width, lines mermaid 12.3.0 draws for the 45-character word]
  it.each([
    [80, 3],
    [120, 2],
    [150, 2],
    [200, 2],
    [300, 1],
  ])('splits one long word like mermaid at width %i', (width, n) => {
    const out = renderMermaidASCII(
      `%%{init: {"sequence": {"wrap": true, "width": ${width}}}}%%\nsequenceDiagram\n participant A\n participant B\n A->>B: ${N}`,
    )
    expect(textRows(out)).toBe(n)
  })

  it('does the same through a wrap: prefix at the default width', () => {
    const out = renderMermaidASCII(
      `sequenceDiagram\n participant A\n participant B\n A->>B: wrap: ${N}`,
    )
    expect(textRows(out)).toBe(2)
    expect(out).not.toContain('wrap:')
  })

  it('keeps a wide message whole with the ASCII charset', () => {
    const out = renderMermaidASCII(
      `%%{init: {"sequence": {"wrap": true, "width": 300}}}%%\nsequenceDiagram\n participant A\n participant B\n A->>B: ${N}`,
      { useAscii: true },
    )
    expect(out).toContain(N)
  })
})
