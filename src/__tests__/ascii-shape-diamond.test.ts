import { describe, it, expect } from 'vitest'
import { diamondRenderer } from '../ascii/shapes/diamond.ts'
import { canvasToString } from '../ascii/canvas.ts'
import type { ShapeRenderOptions } from '../ascii/shapes/types.ts'

describe('diamondRenderer.render', () => {
  it('draws unicode diamond corner markers around a short label', () => {
    const options: ShapeRenderOptions = { useAscii: false, padding: 1 }
    const dimensions = diamondRenderer.getDimensions('Yes', options)
    const canvas = diamondRenderer.render('Yes', dimensions, options)

    const text = canvasToString(canvas)
    const lines = text.split('\n')

    expect(lines[0]!.startsWith('◇')).toBe(true)
    expect(lines[0]!.endsWith('◇')).toBe(true)
    expect(lines[lines.length - 1]!.startsWith('◇')).toBe(true)
    expect(lines[lines.length - 1]!.endsWith('◇')).toBe(true)
    expect(text).toContain('Yes')
  })

  it('draws ascii diamond corner markers around a multi-line label', () => {
    const options: ShapeRenderOptions = { useAscii: true, padding: 1 }
    const label = 'Retry?\nCheck'
    const dimensions = diamondRenderer.getDimensions(label, options)
    const canvas = diamondRenderer.render(label, dimensions, options)

    const text = canvasToString(canvas)
    const lines = text.split('\n')

    expect(lines[0]!.startsWith('<')).toBe(true)
    expect(lines[0]!.endsWith('>')).toBe(true)
    expect(lines[lines.length - 1]!.startsWith('<')).toBe(true)
    expect(lines[lines.length - 1]!.endsWith('>')).toBe(true)
    expect(text).toContain('Retry?')
    expect(text).toContain('Check')
  })
})
