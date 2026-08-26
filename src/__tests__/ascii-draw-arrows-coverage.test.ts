// ============================================================================
// ASCII arrow-drawing coverage — no-arrow edges, bidirectional arrowheads,
// and upward labeled edges (src/ascii/draw-arrows.ts)
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidAscii } from '../ascii/index.ts'

describe('ASCII arrow drawing: no-arrow edges', () => {
  it('renders a solid no-arrow edge without an arrowhead in unicode mode', () => {
    const result = renderMermaidAscii(`
      graph LR
        A --- B
    `)
    expect(result).toContain('─')
    expect(result).not.toMatch(/[►◄▲▼]/)
  })

  it('renders a solid no-arrow edge without an arrowhead in ascii mode', () => {
    const result = renderMermaidAscii(
      `
      graph LR
        A --- B
    `,
      { useAscii: true },
    )
    expect(result).not.toMatch(/[<>^v]/)
  })

  it('renders a dotted no-arrow edge without an arrowhead', () => {
    const result = renderMermaidAscii(`
      graph LR
        A -.- B
    `)
    expect(result).toContain('┄')
    expect(result).not.toMatch(/[►◄▲▼]/)
  })

  it('renders a thick no-arrow edge without an arrowhead', () => {
    const result = renderMermaidAscii(`
      graph LR
        A === B
    `)
    expect(result).toContain('━')
    expect(result).not.toMatch(/[►◄▲▼]/)
  })

  it('renders a vertical no-arrow edge without an arrowhead', () => {
    const result = renderMermaidAscii(`
      graph TD
        A --- B
    `)
    expect(result).not.toMatch(/[►◄▲▼]/)
  })

  it('renders a labeled no-arrow edge', () => {
    const result = renderMermaidAscii(`
      graph LR
        A ---|connects| B
    `)
    expect(result).toContain('connects')
    expect(result).not.toMatch(/[►◄▲▼]/)
  })
})

describe('ASCII arrow drawing: bidirectional edges', () => {
  it('draws arrowheads at both ends of a solid bidirectional edge (LR, unicode)', () => {
    const result = renderMermaidAscii(`
      graph LR
        A <--> B
    `)
    expect(result).toContain('◄')
    expect(result).toContain('►')
  })

  it('draws arrowheads at both ends of a solid bidirectional edge (LR, ascii)', () => {
    const result = renderMermaidAscii(
      `
      graph LR
        A <--> B
    `,
      { useAscii: true },
    )
    expect(result).toContain('<')
    expect(result).toContain('>')
  })

  it('draws arrowheads at both ends of a vertical bidirectional edge (TD, unicode)', () => {
    const result = renderMermaidAscii(`
      graph TD
        A <--> B
    `)
    expect(result).toContain('▲')
    expect(result).toContain('▼')
  })

  it('draws arrowheads at both ends of a vertical bidirectional edge (TD, ascii)', () => {
    const result = renderMermaidAscii(
      `
      graph TD
        A <--> B
    `,
      { useAscii: true },
    )
    expect(result).toContain('^')
    expect(result).toContain('v')
  })

  it('draws arrowheads at both ends of a bidirectional edge reversed by layout (BT)', () => {
    const result = renderMermaidAscii(`
      graph BT
        A <--> B
    `)
    expect(result).toContain('▲')
    expect(result).toContain('▼')
  })

  it('draws arrowheads on a dotted bidirectional edge', () => {
    const result = renderMermaidAscii(`
      graph LR
        A <-.-> B
    `)
    expect(result).toContain('┄')
    expect(result).toContain('◄')
    expect(result).toContain('►')
  })

  it('draws arrowheads on a thick bidirectional edge', () => {
    const result = renderMermaidAscii(`
      graph LR
        A <==> B
    `)
    expect(result).toContain('━')
    expect(result).toContain('◄')
    expect(result).toContain('►')
  })

  it('draws both arrowheads on a bidirectional back-edge routed around other nodes', () => {
    const result = renderMermaidAscii(`
      graph LR
        A --> B
        B --> C
        C <--> A
    `)
    expect(result).toContain('►')
    expect(result).toContain('▲')
  })

  it('draws a labeled bidirectional edge', () => {
    const result = renderMermaidAscii(`
      graph LR
        A <-->|sync| B
    `)
    expect(result).toContain('sync')
    expect(result).toContain('◄')
    expect(result).toContain('►')
  })
})

describe('ASCII arrow drawing: upward edge labels', () => {
  it('offsets the label on an edge that routes upward', () => {
    const result = renderMermaidAscii(`
      graph TD
        A --> B
        B -->|back| A
    `)
    expect(result).toContain('back')
    expect(result).toContain('▲')
    expect(result).toContain('▼')
  })
})
