/**
 * #2561: an LR box with a labelled edge to its first child was moved into its
 * own slot (`fitsStraddled` measured the label against the child's width, a
 * vertical-axis size in LR), pushing the second child and everything under it
 * about ten rows down. The box now straddles its two children, as mermaid does.
 */
// Provenance (#2679): the .snap is this renderer's own output, accepted once when the test was written. It does not claim to match mermaid.js.
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

const SRC = `flowchart LR
  S0 --> |e0| S1
  S1 --> |e1| S2
  S1 --> S3
  S0 --> S4`

describe('LR labelled fan-out stays compact (#2561)', () => {
  it.each([false, true])('is 13 rows tall, useAscii=%s', (useAscii) => {
    const out = renderMermaidASCII(SRC, { colorMode: 'none', useAscii })
    expect(out.split('\n')).toHaveLength(13)
  })

  it('keeps the diamond decision layout (labels ride its trunk)', () => {
    const out = renderMermaidASCII(
      `flowchart LR
  A --> B{Ok?}
  B -->|yes| C
  B -->|no| D`,
      { colorMode: 'none' },
    )
    expect(out.split('\n').length).toBeGreaterThan(13)
  })

  it('snapshots ASCII and SVG', () => {
    expect(renderMermaidASCII(SRC, { colorMode: 'none' })).toMatchSnapshot(
      'ascii',
    )
    expect(
      renderMermaidASCII(SRC, { colorMode: 'none', useAscii: true }),
    ).toMatchSnapshot('ascii-ascii')
    expect(renderMermaidSVG(SRC)).toMatchSnapshot('svg')
  })
})
