import { describe, it, expect } from 'vitest'
import { diamondRenderer } from '../shapes/index.ts'
import { canvasToString } from '../canvas.ts'
import type { ShapeRenderOptions } from '../shapes/types.ts'

function render(label: string, options: ShapeRenderOptions): string {
  const dimensions = diamondRenderer.getDimensions(label, options)
  return canvasToString(diamondRenderer.render(label, dimensions, options))
}

describe('diamondRenderer.render', () => {
  it('draws a rhombus with < > points (unicode)', () => {
    expect(render('Hi', { useAscii: false, padding: 1 })).toBe(
      ['  ╱╲  ', ' ╱  ╲ ', '< Hi >', ' ╲  ╱ ', '  ╲╱  '].join('\n'),
    )
  })

  it('draws the same rhombus in the ASCII charset', () => {
    expect(render('Hi', { useAscii: true, padding: 1 })).toBe(
      ['  /\\  ', ' /  \\ ', '< Hi >', ' \\  / ', '  \\/  '].join('\n'),
    )
  })

  it('widens so a wide (CJK) label clears the diagonals', () => {
    const lines = render('日本語 label', { useAscii: false, padding: 1 }).split(
      '\n',
    )
    // Square like mermaid 12.3.0's (#2707): the label sits on the middle row.
    expect(lines[Math.floor(lines.length / 2)]).toMatch(/^< +日本語 label +>$/)
    expect(lines[0]!.replace(/ /g, '')).toBe('╱╲')
    expect(lines.length).toBeGreaterThan(5)
  })

  it('grows a tall narrow label wider so every row clears the diagonals', () => {
    expect(render('a\nb\nc', { useAscii: false, padding: 1 })).toBe(
      [
        '   ╱╲   ',
        '  ╱  ╲  ',
        ' ╱ a  ╲ ',
        '<  b   >',
        ' ╲ c  ╱ ',
        '  ╲  ╱  ',
        '   ╲╱   ',
      ].join('\n'),
    )
  })

  it('draws multi-line labels clear of the diagonals', () => {
    const text = render('Retry?\nCheck', { useAscii: true, padding: 1 })
    expect(text).toContain('Retry?')
    expect(text).toContain('Check')
    const rows = text.split('\n')
    expect(rows[3]!.startsWith('<')).toBe(true)
    expect(rows[3]!.trimEnd().endsWith('>')).toBe(true)
  })
})
