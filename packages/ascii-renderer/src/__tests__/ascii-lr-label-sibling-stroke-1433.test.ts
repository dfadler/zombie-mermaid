/**
 * #1433: in an LR graph a label centred on a horizontal run covered the
 * sibling stem dropping off the same node, so B --> D had no visible path out
 * of B (the mirror of the TD stem case in #1413).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const SRC = `flowchart LR
  A --> B
  A -->|first| C
  B -->|second| C
  A -->|third| D
  C -->|fourth| D
  B -->|fifth| D`

describe('LR label clear of a sibling stem (#1433)', () => {
  it('keeps every node-to-lane stem (unicode)', () => {
    const rows = renderMermaidASCII(SRC, { colorMode: 'none' }).split('\n')
    const row = rows.find((r) => r.includes('│ B ├'))!
    // A, B and C each tee down into the shared lane.
    expect(row.match(/┬/g)).toHaveLength(3)
  })

  it('draws every label, even where two edges share a drop into D (unicode)', () => {
    const out = renderMermaidASCII(SRC, { colorMode: 'none' })
    for (const label of ['first', 'second', 'third', 'fourth', 'fifth']) {
      expect(out).toContain(label)
    }
  })

  it('still draws the moved labels (ascii)', () => {
    const out = renderMermaidASCII(SRC, { colorMode: 'none', useAscii: true })
    for (const label of ['first', 'second', 'third', 'fourth', 'fifth']) {
      expect(out).toContain(label)
    }
  })
})
