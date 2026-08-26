import { describe, it, expect } from 'vitest'
import { hexagonRenderer } from '../ascii/shapes/hexagon.ts'
import { canvasToString } from '../ascii/canvas.ts'
import type { ShapeRenderOptions } from '../ascii/shapes/types.ts'

describe('hexagonRenderer.render', () => {
  it('draws Unicode hexagon corner markers around a single-line label', () => {
    const options: ShapeRenderOptions = { useAscii: false, padding: 1 }
    const dimensions = hexagonRenderer.getDimensions('Step', options)

    const canvas = hexagonRenderer.render('Step', dimensions, options)
    const text = canvasToString(canvas)
    const lines = text.split('\n')

    expect(lines[0]).toMatch(/^⌜─+⌝$/)
    expect(lines[lines.length - 1]).toMatch(/^⌞─+⌟$/)
    expect(text).toContain('Step')
    for (const line of lines.slice(1, -1)) {
      expect(line.startsWith('│')).toBe(true)
      expect(line.endsWith('│')).toBe(true)
    }
  })

  it('draws ASCII hexagon corner markers around a multi-line label', () => {
    const options: ShapeRenderOptions = { useAscii: true, padding: 1 }
    const label = 'Long\nLabel'
    const dimensions = hexagonRenderer.getDimensions(label, options)

    const canvas = hexagonRenderer.render(label, dimensions, options)
    const text = canvasToString(canvas)
    const lines = text.split('\n')

    expect(lines[0]).toMatch(/^\*-+\*$/)
    expect(lines[lines.length - 1]).toMatch(/^\*-+\*$/)
    expect(text).toContain('Long')
    expect(text).toContain('Label')
    for (const line of lines.slice(1, -1)) {
      expect(line.startsWith('|')).toBe(true)
      expect(line.endsWith('|')).toBe(true)
    }
  })
})
