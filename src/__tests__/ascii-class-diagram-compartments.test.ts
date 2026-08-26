// ============================================================================
// ASCII class diagram compartment tests (issue #87)
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

describe('ASCII class diagram box compartments', () => {
  it('omits the attrs compartment for a class with methods but no attributes (regression)', () => {
    // Before the fix, buildClassSections() always returned a 3-section box
    // once methods were non-empty, even with zero attrs — drawMultiBox then
    // rendered that empty section as a visible blank compartment.
    const ascii = renderMermaidASCII(
      `classDiagram
        class Animal {
          +makeSound()
        }`,
      { useAscii: true },
    )
    const lines = ascii.split('\n').filter((l) => l.trim().length > 0)
    // A box with N sections has N+1 horizontal border lines (top, N-1
    // internal dividers, bottom). 2 sections (header + methods) -> 3.
    const dividerCount = lines.filter((l) => /^\+-+\+$/.test(l.trim())).length
    expect(dividerCount).toBe(3)
    expect(ascii).toContain('makeSound')
    expect(ascii).not.toMatch(/\|\s*\|\n\+-+\+\n\|\s*\+makeSound/)
  })

  it('omits the methods compartment for a class with attrs but no methods (no regression)', () => {
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
    expect(dividerCount).toBe(3)
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

  it('renders header only for a class with neither attrs nor methods', () => {
    const ascii = renderMermaidASCII(
      `classDiagram
        class Empty`,
      { useAscii: true },
    )
    expect(ascii).toContain('Empty')
    const lines = ascii.split('\n').filter((l) => l.trim().length > 0)
    const dividerCount = lines.filter((l) => /^\+-+\+$/.test(l.trim())).length
    expect(dividerCount).toBe(2)
  })
})
