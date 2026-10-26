import { describe, it, expect } from 'vitest'
import { hexagonRenderer } from '../shapes/index.ts'
import { canvasToString } from '../canvas.ts'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import type { ShapeRenderOptions } from '../shapes/types.ts'

const render = (label: string, options: ShapeRenderOptions): string[] => {
  const dimensions = hexagonRenderer.getDimensions(label, options)
  return canvasToString(
    hexagonRenderer.render(label, dimensions, options),
  ).split('\n')
}

describe('hexagonRenderer.render (#2164)', () => {
  it('draws mermaid-style points at the left and right middle (unicode)', () => {
    expect(render('Step', { useAscii: false, padding: 1 })).toEqual([
      '  ╱──╲  ',
      ' ╱    ╲ ',
      '< Step >',
      ' ╲    ╱ ',
      '  ╲──╱  ',
    ])
  })

  it('uses / \\ < > in the ASCII charset and widens for a taller label', () => {
    expect(render('Long\nLabel', { useAscii: true, padding: 1 })).toEqual([
      '   /---\\   ',
      '  /     \\  ',
      ' /       \\ ',
      '<   Long  >',
      ' \\ Label / ',
      '  \\     /  ',
      '   \\---/   ',
    ])
  })

  it('keeps the diagonals clear of a wide (CJK) label', () => {
    const label = '日本語 long label'
    const lines = render(label, { useAscii: false, padding: 1 })
    const apex = lines[Math.floor(lines.length / 2)]!
    expect(apex.startsWith('<')).toBe(true)
    expect(apex.endsWith('>')).toBe(true)
    expect(apex).toContain(label)
    // Every row spans the same number of cells (wide glyphs count two).
    const cells = (s: string) =>
      [...s].reduce((n, c) => n + (c > '\u2e80' ? 2 : 1), 0)
    expect(new Set(lines.map(cells)).size).toBe(1)
  })

  it('takes the same width as a rectangle for a one-line label', () => {
    const rect = renderMermaidASCII('graph LR\n A[Step]', { useAscii: false })
    const hex = renderMermaidASCII('graph LR\n A{{Step}}', { useAscii: false })
    const width = (s: string) => Math.max(...s.split('\n').map((l) => l.length))
    expect(width(hex)).toBe(width(rect))
  })
})

describe('hexagon in a flowchart', () => {
  it('keeps the point when an edge leaves it, in both charsets', () => {
    const src = 'graph LR\n A{{Step}} --> B[End]'
    expect(renderMermaidASCII(src, { useAscii: false })).toContain('< Step >─')
    expect(renderMermaidASCII(src, { useAscii: true })).toContain('< Step >-')
  })
})
