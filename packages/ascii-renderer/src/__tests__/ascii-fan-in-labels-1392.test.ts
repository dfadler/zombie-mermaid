/**
 * #1392: two labelled edges into one LR node. The second edge's label used to
 * land on the row the first label already held and overwrite it, and the first
 * label then covered the tee where the second edge joins the row.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const SRC = `flowchart LR
  B --> C
  D -->|third label| E
  C -->|fourth label| E`

describe('ASCII fan-in labels (#1392)', () => {
  const out = renderMermaidASCII(SRC, { colorMode: 'none' })

  it('draws each label once and complete', () => {
    expect(out.match(/third label/g)).toHaveLength(1)
    expect(out.match(/fourth label/g)).toHaveLength(1)
  })

  it('keeps the tee where the second edge joins the first, and the arrowhead', () => {
    const row = out.split('\n').find((r) => r.includes('third label'))!
    expect(row).toContain('┴')
    expect(row).toContain('►')
  })
})
