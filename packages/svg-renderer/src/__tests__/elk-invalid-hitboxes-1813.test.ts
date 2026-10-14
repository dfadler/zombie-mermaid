import { describe, it, expect } from 'vitest'
import { renderMermaidASCII, renderMermaidSVG } from '../../../../src/index.ts'

// ELK's LEFT_RIGHT_CONSTRAINT_LOCKING post-compaction threw
// "Invalid hitboxes for scanline constraint calculation" for disconnected
// components with wide inline edge labels (#1813).
const label = 'a longer label here'
const flow = `flowchart TD
  A -->|${label}| B
  C -->|${label}| D
  E -->|${label}| F
  G -->|${label}| H`
const flowSubgraph = `${flow}
  subgraph S
    A
    B
  end`
const state = `stateDiagram-v2
  A --> B : ${label}
  C --> D : ${label}
  E --> F : ${label}
  G --> H : ${label}`

describe.each([
  ['flowchart', flow],
  ['state diagram', state],
  ['flowchart with a subgraph', flowSubgraph],
])('disconnected wide-labelled edges, %s (#1813)', (_n, src) => {
  it('renders SVG with every label', () => {
    const svg = renderMermaidSVG(src)
    expect(svg.split(label).length - 1).toBeGreaterThanOrEqual(4)
  })

  it('renders ASCII with every label', () => {
    expect(renderMermaidASCII(src).split(label).length - 1).toBe(4)
  })
})
