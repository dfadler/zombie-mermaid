// ============================================================================
// ASCII arrow-drawing coverage — no-arrow edges, bidirectional arrowheads,
// and upward labeled edges (src/ascii/draw-arrows.ts)
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { unicodeArrowChar, asciiArrowChar } from '../draw-arrows.ts'
import {
  Up,
  Down,
  Left,
  Right,
  UpperRight,
  UpperLeft,
  LowerRight,
  LowerLeft,
  Middle,
} from '../types.ts'

describe('ASCII arrow drawing: no-arrow edges', () => {
  it('renders a solid no-arrow edge without an arrowhead in unicode mode', () => {
    const result = renderMermaidASCII(`
      graph LR
        A --- B
    `)
    expect(result).toContain('─')
    expect(result).not.toMatch(/[►◄▲▼]/)
  })

  it('renders a solid no-arrow edge without an arrowhead in ascii mode', () => {
    const result = renderMermaidASCII(
      `
      graph LR
        A --- B
    `,
      { useAscii: true },
    )
    expect(result).not.toMatch(/[<>^v]/)
  })

  it('renders a dotted no-arrow edge without an arrowhead', () => {
    const result = renderMermaidASCII(`
      graph LR
        A -.- B
    `)
    expect(result).toContain('┄')
    expect(result).not.toMatch(/[►◄▲▼]/)
  })

  it('renders a thick no-arrow edge without an arrowhead', () => {
    const result = renderMermaidASCII(`
      graph LR
        A === B
    `)
    expect(result).toContain('━')
    expect(result).not.toMatch(/[►◄▲▼]/)
  })

  it('renders a vertical no-arrow edge without an arrowhead', () => {
    const result = renderMermaidASCII(`
      graph TD
        A --- B
    `)
    expect(result).not.toMatch(/[►◄▲▼]/)
  })

  it('renders a labeled no-arrow edge', () => {
    const result = renderMermaidASCII(`
      graph LR
        A ---|connects| B
    `)
    expect(result).toContain('connects')
    expect(result).not.toMatch(/[►◄▲▼]/)
  })
})

describe('ASCII arrow drawing: bidirectional edges', () => {
  it('draws arrowheads at both ends of a solid bidirectional edge (LR, unicode)', () => {
    const result = renderMermaidASCII(`
      graph LR
        A <--> B
    `)
    expect(result).toContain('◄')
    expect(result).toContain('►')
  })

  it('draws arrowheads at both ends of a solid bidirectional edge (LR, ascii)', () => {
    const result = renderMermaidASCII(
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
    const result = renderMermaidASCII(`
      graph TD
        A <--> B
    `)
    expect(result).toContain('▲')
    expect(result).toContain('▼')
  })

  it('draws arrowheads at both ends of a vertical bidirectional edge (TD, ascii)', () => {
    const result = renderMermaidASCII(
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
    const result = renderMermaidASCII(`
      graph BT
        A <--> B
    `)
    expect(result).toContain('▲')
    expect(result).toContain('▼')
  })

  it('draws arrowheads on a dotted bidirectional edge', () => {
    const result = renderMermaidASCII(`
      graph LR
        A <-.-> B
    `)
    expect(result).toContain('┄')
    expect(result).toContain('◄')
    expect(result).toContain('►')
  })

  it('draws arrowheads on a thick bidirectional edge', () => {
    const result = renderMermaidASCII(`
      graph LR
        A <==> B
    `)
    expect(result).toContain('━')
    expect(result).toContain('◄')
    expect(result).toContain('►')
  })

  it('draws both arrowheads on a bidirectional back-edge routed around other nodes', () => {
    const result = renderMermaidASCII(`
      graph LR
        A --> B
        B --> C
        C <--> A
    `)
    expect(result).toContain('►')
    expect(result).toContain('▲')
  })

  it('draws a labeled bidirectional edge', () => {
    const result = renderMermaidASCII(`
      graph LR
        A <-->|sync| B
    `)
    expect(result).toContain('sync')
    expect(result).toContain('◄')
    expect(result).toContain('►')
  })
})

describe('unicodeArrowChar / asciiArrowChar: direction-to-glyph mapping', () => {
  // Direct unit coverage for every Direction, including LowerLeft — the
  // ELK/pathfinder layout this module draws from only produces a diagonal
  // direction via determinePath's rare Case-4 fallback, and every
  // hand-written or gallery diagram that triggers it happens to need the
  // target down-and-*right* of its source, never down-and-left. See
  // issue #1062's drawArrowHead refactor.
  it('maps all four orthogonal directions to filled triangles (unicode)', () => {
    expect(unicodeArrowChar(Up)).toBe('▲')
    expect(unicodeArrowChar(Down)).toBe('▼')
    expect(unicodeArrowChar(Left)).toBe('◄')
    expect(unicodeArrowChar(Right)).toBe('►')
  })

  it('maps all four diagonal directions to Arrows-block glyphs (unicode)', () => {
    expect(unicodeArrowChar(UpperRight)).toBe('↗')
    expect(unicodeArrowChar(UpperLeft)).toBe('↖')
    expect(unicodeArrowChar(LowerRight)).toBe('↘')
    expect(unicodeArrowChar(LowerLeft)).toBe('↙')
  })

  it('returns undefined for Middle (no arrowhead glyph)', () => {
    expect(unicodeArrowChar(Middle)).toBeUndefined()
    expect(asciiArrowChar(Middle)).toBeUndefined()
  })

  it('maps all four orthogonal directions to ASCII carets (ascii mode)', () => {
    expect(asciiArrowChar(Up)).toBe('^')
    expect(asciiArrowChar(Down)).toBe('v')
    expect(asciiArrowChar(Left)).toBe('<')
    expect(asciiArrowChar(Right)).toBe('>')
  })

  it('has no diagonal glyphs in ASCII mode', () => {
    expect(asciiArrowChar(UpperRight)).toBeUndefined()
    expect(asciiArrowChar(UpperLeft)).toBeUndefined()
    expect(asciiArrowChar(LowerRight)).toBeUndefined()
    expect(asciiArrowChar(LowerLeft)).toBeUndefined()
  })
})

describe('ASCII arrow drawing: upward edge labels', () => {
  it('offsets the label on an edge that routes upward', () => {
    const result = renderMermaidASCII(`
      graph TD
        A --> B
        B -->|back| A
    `)
    expect(result).toContain('back')
    expect(result).toContain('▲')
    expect(result).toContain('▼')
  })
})
