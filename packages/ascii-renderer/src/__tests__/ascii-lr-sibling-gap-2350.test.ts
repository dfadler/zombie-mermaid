import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const rows = (src: string, paddingY?: number): number =>
  renderMermaidASCII(src, { paddingY }).trimEnd().split('\n').length

describe('LR sibling gap is paddingY - 1 (#2350)', () => {
  const lr = 'graph LR\n  A --> B & C & D & E'
  const td = 'graph TD\n  A --> B & C'

  it('has 4 blank rows between B and C at the default paddingY', () => {
    const lines = renderMermaidASCII(lr).split('\n')
    const bBottom = lines.findIndex((l) => l[10] === '└')
    const cTop = lines.findIndex((l, i) => i > bBottom && l[10] === '┌')
    expect(cTop - bBottom - 1).toBe(4)
  })

  it('-y 6 gives the old gap (2 rows taller on the 4-sibling sample)', () => {
    expect(rows(lr, 6)).toBe(rows(lr) + 2)
  })

  it('never goes below one blank row between siblings', () => {
    const gap = (paddingY: number): number => {
      const lines = renderMermaidASCII(lr, { paddingY }).split('\n')
      const bBottom = lines.findIndex((l) => l[10] === '└')
      const cTop = lines.findIndex((l, i) => i > bBottom && l[10] === '┌')
      return cTop - bBottom - 1
    }
    expect([0, 1, 2, 3].map(gap)).toEqual([1, 1, 1, 2])
  })

  it('leaves TD rank spacing at paddingY', () => {
    expect(rows(td, 5)).toBe(rows(td))
    expect(rows(td, 6)).toBe(rows(td) + 1)
  })
})
