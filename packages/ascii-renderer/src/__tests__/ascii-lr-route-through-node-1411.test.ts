/**
 * #1411: when a style/overlap reroute leaves no clear route, the edge keeps
 * its earlier clear path instead of falling back to a straight line that
 * ignores occupancy and is drawn through another node.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const LR = `graph LR
A -->|x| B
B -->|long label| A
A -->|long label| C
C -->|ab| A
B -->|mid| D
A -->|ab| D
D -->|x| A`

describe('LR dense reciprocal diagram (#1411)', () => {
  it('keeps every node label intact (no edge routed through a node)', () => {
    const out = renderMermaidASCII(LR, { colorMode: 'none' })
    for (const n of ['A', 'B', 'C', 'D']) {
      expect(out).toMatch(new RegExp(`[│├┤] ${n} +[│├┤]`))
    }
    expect(out).not.toMatch(/┼ {3}┼|►┼/)
  })
})
