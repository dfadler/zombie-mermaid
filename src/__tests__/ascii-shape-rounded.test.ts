import { describe, it, expect } from 'vitest'
import { roundedRenderer } from '../ascii/shapes/rounded.ts'
import { canvasToString } from '../ascii/canvas.ts'
import type { ShapeRenderOptions } from '../ascii/shapes/types.ts'

describe('roundedRenderer.render', () => {
  it('draws Unicode rounded corners around a single-line label', () => {
    const options: ShapeRenderOptions = { useAscii: false, padding: 1 }
    const dimensions = roundedRenderer.getDimensions('Start', options)
    const canvas = roundedRenderer.render('Start', dimensions, options)
    const text = canvasToString(canvas)

    const lines = text.split('\n')
    expect(lines[0]!.startsWith('╭')).toBe(true)
    expect(lines[0]!.endsWith('╮')).toBe(true)
    expect(lines[lines.length - 1]!.startsWith('╰')).toBe(true)
    expect(lines[lines.length - 1]!.endsWith('╯')).toBe(true)
    expect(text).toContain('Start')
  })

  it('draws ASCII rounded corners around a multi-line label', () => {
    const options: ShapeRenderOptions = { useAscii: true, padding: 2 }
    const label = 'Hello\nWorld'
    const dimensions = roundedRenderer.getDimensions(label, options)
    const canvas = roundedRenderer.render(label, dimensions, options)
    const text = canvasToString(canvas)

    const lines = text.split('\n')
    expect(lines[0]!.startsWith('.')).toBe(true)
    expect(lines[0]!.endsWith('.')).toBe(true)
    expect(lines[lines.length - 1]!.startsWith("'")).toBe(true)
    expect(lines[lines.length - 1]!.endsWith("'")).toBe(true)
    expect(text).toContain('Hello')
    expect(text).toContain('World')
  })
})
