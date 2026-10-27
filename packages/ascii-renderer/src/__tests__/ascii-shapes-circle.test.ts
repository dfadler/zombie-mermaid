import { describe, it, expect } from 'vitest'
import { circleRenderer } from '../shapes/index.ts'
import { canvasToString } from '../canvas.ts'
import type { ShapeRenderOptions } from '../shapes/types.ts'

function render(label: string, options: ShapeRenderOptions): string {
  const dimensions = circleRenderer.getDimensions(label, options)
  const canvas = circleRenderer.render(label, dimensions, options)
  return canvasToString(canvas)
}

describe('circleRenderer', () => {
  it('draws a rounded outline with ( ) at the middle (unicode)', () => {
    expect(render('Hi', { useAscii: false, padding: 1 })).toBe(
      [' ╭──╮ ', ' ╱  ╲ ', '( Hi )', ' ╲  ╱ ', ' ╰──╯ '].join('\n'),
    )
  })

  it('draws the same outline in the ASCII charset', () => {
    expect(render('Hi', { useAscii: true, padding: 1 })).toBe(
      [' .--. ', ' /  \\ ', '( Hi )', ' \\  / ', " '--' "].join('\n'),
    )
  })

  it('grows with a tall label so the arc never touches the text', () => {
    expect(render('a\nb\nc', { useAscii: false, padding: 1 })).toBe(
      [
        '  ╭─╮  ',
        '  ╱ ╲  ',
        ' ╱ a ╲ ',
        '(  b  )',
        ' ╲ c ╱ ',
        '  ╲ ╱  ',
        '  ╰─╯  ',
      ].join('\n'),
    )
  })

  it('keeps the border where it is for a wide (CJK) label', () => {
    const lines = render('日本語 label', { useAscii: false, padding: 1 }).split(
      '\n',
    )
    expect(lines[2]!.startsWith('(')).toBe(true)
    expect(lines[2]!.endsWith(')')).toBe(true)
    expect(lines[2]).toContain('日本語 label')
  })
})
