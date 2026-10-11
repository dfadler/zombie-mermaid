/**
 * #1393: with `paddingX` 1 or 2, the gap before an LR child with several
 * parents was too narrow for the join, so the farther parent's edge rose onto
 * the arrowhead cell and read as dead-ending beside the child. The gap is now
 * at least 3 wide there (junction column + arrowhead column).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const SRC = 'flowchart LR\n  A --> B\n  A --> C\n  B --> C'

describe('LR fan-in with narrow paddingX (#1393)', () => {
  it.each([1, 2, 3])('paddingX %i joins the edges with a junction', (p) => {
    const rows = renderMermaidASCII(SRC, {
      colorMode: 'none',
      paddingX: p,
    }).split('\n')
    expect(rows[2]).toMatch(/B ├─┬►│ C │$/)
    expect(rows[3]).toMatch(/│ │ │ {3}│$/)
  })

  it('leaves a single-parent gap at the requested paddingX', () => {
    const out = renderMermaidASCII('flowchart LR\n  A --> B', {
      colorMode: 'none',
      paddingX: 1,
    })
    expect(out).toContain('│ A ├►│ B │')
  })
})
