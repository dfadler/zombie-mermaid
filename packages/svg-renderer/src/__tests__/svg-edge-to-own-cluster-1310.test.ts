/**
 * #1310 — real mermaid.js (11.17.2) draws no line for an edge between a node
 * and a subgraph that contains it (the edge path is zero-length). The SVG
 * renderer used to draw degenerate stubs for it; it now omits the edge, so the
 * output equals the same diagram without that edge.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../../../../src/index.ts'

const base = 'flowchart TD; subgraph Sub; B; end; A --> B'

describe('SVG: an edge between a node and its own subgraph (#1310)', () => {
  it.each([
    ['member to subgraph', `${base}; B --> Sub`],
    ['subgraph to member', `${base}; Sub --> B`],
    [
      'nested containment',
      'flowchart TD; subgraph Outer; subgraph Inner; B; end; end; A --> B; B --> Outer; Inner --> B; Outer --> Inner',
    ],
  ])('renders %s identically to the diagram without the edge', (_, src) => {
    const without = src.includes('Outer')
      ? 'flowchart TD; subgraph Outer; subgraph Inner; B; end; end; A --> B'
      : base
    expect(renderMermaidSVG(src)).toBe(renderMermaidSVG(without))
  })

  it('still draws an edge from an outside node to the subgraph', () => {
    expect(renderMermaidSVG(`${base}; X --> Sub`)).not.toBe(
      renderMermaidSVG(base),
    )
  })
})
