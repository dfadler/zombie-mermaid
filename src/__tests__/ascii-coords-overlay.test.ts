import { describe, it, expect } from 'vitest'
import { addCoordsOverlay } from '../ascii/coords.ts'
import { renderMermaidASCII } from '../ascii/index.ts'

describe('addCoordsOverlay', () => {
  it('prepends a two-row column ruler and a row-index gutter', () => {
    const rendered = 'AB\nCD'
    const result = addCoordsOverlay(rendered)
    const lines = result.split('\n')

    // Two ruler rows on top, then one gutter-prefixed row per original line.
    expect(lines).toHaveLength(4)
    expect(lines[0]).toBe('  00')
    expect(lines[1]).toBe('  01')
    expect(lines[2]).toBe('0 AB')
    expect(lines[3]).toBe('1 CD')
  })

  it('pads the row gutter to fit multi-digit row indices', () => {
    const rendered = Array.from({ length: 11 }, (_, i) => `row${i}`).join('\n')
    const result = addCoordsOverlay(rendered)
    const lines = result.split('\n')

    // Row gutter width is 2 (since max row index is 10), so row 0's label
    // is right-aligned as " 0" and row 10's as "10".
    expect(lines[2]?.startsWith(' 0 ')).toBe(true)
    expect(lines[lines.length - 1]?.startsWith('10 ')).toBe(true)
  })

  it('handles an empty string without throwing', () => {
    expect(() => addCoordsOverlay('')).not.toThrow()
  })

  it('measures width by visible characters, not raw length with ANSI codes', () => {
    // A 2-char-wide line wrapped in a color escape sequence is still only
    // 2 columns wide on screen — the ruler must match that, not the ~10
    // raw characters the escape codes add.
    const colored = '\x1b[37mAB\x1b[0m'
    const result = addCoordsOverlay(colored)
    const lines = result.split('\n')
    expect(lines[0]).toBe('  00')
    expect(lines[1]).toBe('  01')
  })
})

describe('renderMermaidASCII – showCoords', () => {
  const DIAGRAM = 'graph LR\n  A --> B'

  it('is off by default (no ruler in output)', () => {
    const result = renderMermaidASCII(DIAGRAM)
    // Without the overlay, the very first line is drawing content, not a
    // row of digit-only ruler characters starting at the left margin.
    expect(result.split('\n')[0]).not.toMatch(/^\s*0123456789/)
  })

  it('overlays coordinate rulers when showCoords is true', () => {
    const plain = renderMermaidASCII(DIAGRAM)
    const withCoords = renderMermaidASCII(DIAGRAM, { showCoords: true })

    expect(withCoords).not.toBe(plain)
    expect(withCoords.split('\n').length).toBe(plain.split('\n').length + 2)
    expect(withCoords).toContain('0123456789')
  })
})
