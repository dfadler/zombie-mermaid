// ============================================================================
// ASCII class diagram compartment tests (issue #87)
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

describe('ASCII class diagram box compartments', () => {
  it('keeps an empty attrs compartment for a class with methods but no attributes (mermaid parity)', () => {
    // Mermaid 12.3.0 always draws three compartments; an empty one is a blank
    // row between dividers.
    const ascii = renderMermaidASCII(
      `classDiagram
        class Animal {
          +makeSound()
        }`,
      { useAscii: true },
    )
    const lines = ascii.split('\n').filter((l) => l.trim().length > 0)
    // A box with N sections has N+1 horizontal border lines (top, N-1
    // internal dividers, bottom). 3 sections -> 4.
    const dividerCount = lines.filter((l) => /^\+-+\+$/.test(l.trim())).length
    expect(dividerCount).toBe(4)
    expect(ascii).toContain('makeSound')
    expect(ascii).toMatch(/\|\s+\|\s*\n\+-+\+\s*\n\|\s*\+makeSound/)
  })

  it('keeps an empty methods compartment for a class with attrs but no methods (mermaid parity)', () => {
    const ascii = renderMermaidASCII(
      `classDiagram
        class Point {
          +int x
        }`,
      { useAscii: true },
    )
    expect(ascii).toContain('x')
    const lines = ascii.split('\n').filter((l) => l.trim().length > 0)
    const dividerCount = lines.filter((l) => /^\+-+\+$/.test(l.trim())).length
    expect(dividerCount).toBe(4)
  })

  it('renders both compartments for a class with attrs and methods', () => {
    const ascii = renderMermaidASCII(
      `classDiagram
        class Circle {
          +radius int
          +draw() void
        }`,
      { useAscii: true },
    )
    expect(ascii).toContain('radius')
    expect(ascii).toContain('draw')
    const lines = ascii.split('\n').filter((l) => l.trim().length > 0)
    const dividerCount = lines.filter((l) => /^\+-+\+$/.test(l.trim())).length
    expect(dividerCount).toBe(4)
  })

  it('renders header plus two empty compartments for a class with neither attrs nor methods', () => {
    const ascii = renderMermaidASCII(
      `classDiagram
        class Empty`,
      { useAscii: true },
    )
    expect(ascii).toContain('Empty')
    const lines = ascii.split('\n').filter((l) => l.trim().length > 0)
    const dividerCount = lines.filter((l) => /^\+-+\+$/.test(l.trim())).length
    expect(dividerCount).toBe(4)
  })
})
