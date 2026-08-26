/**
 * Regression test for a cosmetic centering bug noticed as an aside while
 * investigating issue #65 (edges between subgraph ids). When a subgraph's
 * label length and the box's interior width have opposite parity, the
 * leftover column can't be split evenly between the two sides of the
 * centered title. The old centering formula
 * (`floor(width/2) - floor(label/2)`) always gave the leftover column to
 * the right side, which could zero out the *left* padding entirely and
 * make the title glue directly to the left border — e.g. `│Second │`
 * instead of a title that, like every other row in the box, never touches
 * the border.
 *
 * `drawSubgraphLabel` (src/ascii/draw-subgraphs.ts) now biases the leftover
 * column to the right side's padding instead, guaranteeing at least one
 * space of left padding whenever the box has any slack at all.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidAscii } from '../ascii/index.ts'

/** Find the line containing a subgraph's rendered title text. */
function findTitleLine(output: string, title: string): string {
  const line = output.split('\n').find((l) => l.includes(title))
  if (line === undefined) {
    throw new Error(`title "${title}" not found in output:\n${output}`)
  }
  return line
}

describe('ASCII subgraph title padding (aside from issue #65)', () => {
  const mermaid = `flowchart TD
  subgraph ONE["First"]
    A1["a"] --> A2["b"]
  end
  subgraph TWO["Second"]
    B1["c"] --> B2["d"]
  end
  ONE --> TWO`

  it('never glues a subgraph title to its left border, even when a connector column runs through the title row', () => {
    const output = renderMermaidAscii(mermaid)

    const firstLine = findTitleLine(output, 'First')
    const secondLine = findTitleLine(output, 'Second')

    // Both title rows must start with a border char followed by at least
    // one space before the label text — never `│First` or `│Second`.
    expect(firstLine).toMatch(/^│ First/)
    expect(secondLine).toMatch(/^│ Second/)

    // Exact known-good output (captured from a real renderMermaidASCII run;
    // not fabricated) — locks in the fix precisely.
    expect(firstLine).toBe('│ First │')
    expect(secondLine).toBe('│ Second│')
  })

  it('still centers a title symmetrically when the label/width parity allows it', () => {
    // "First" (5 chars) fits its box's interior (7 cols) with one space of
    // padding on both sides — this must remain unaffected by the fix.
    const output = renderMermaidAscii(mermaid)
    const firstLine = findTitleLine(output, 'First')
    expect(firstLine).toBe('│ First │')
  })

  it('does not require a subgraph-to-subgraph connector to reproduce — it is a general centering parity issue', () => {
    const mermaidNoEdge = `flowchart TD
  subgraph ONE["First"]
    A1["a"] --> A2["b"]
  end
  subgraph TWO["Second"]
    B1["c"] --> B2["d"]
  end`

    const output = renderMermaidAscii(mermaidNoEdge)
    const secondLine = findTitleLine(output, 'Second')
    expect(secondLine).toMatch(/│ Second/)
  })
})
