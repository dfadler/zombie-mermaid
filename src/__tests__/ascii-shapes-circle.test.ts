import { describe, it, expect } from 'vitest'
import { circleRenderer } from '../ascii/shapes/circle.ts'
import { canvasToString } from '../ascii/canvas.ts'
import type { ShapeRenderOptions } from '../ascii/shapes/types.ts'

function render(label: string, options: ShapeRenderOptions): string {
  const dimensions = circleRenderer.getDimensions(label, options)
  const canvas = circleRenderer.render(label, dimensions, options)
  return canvasToString(canvas)
}

describe('circleRenderer', () => {
  it('renders unicode circle corner markers around a short label', () => {
    const output = render('Hi', { useAscii: false, padding: 1 })

    expect(output).toBe(
      ['◯────◯', '│    │', '│ Hi │', '│    │', '◯────◯'].join('\n'),
    )
  })

  it('renders ascii circle corner markers around a short label', () => {
    const output = render('Hi', { useAscii: true, padding: 1 })

    expect(output).toBe(
      ['o----o', '|    |', '| Hi |', '|    |', 'o----o'].join('\n'),
    )
  })

  it('grows to fit a longer label and keeps it centered', () => {
    const output = render('Longer Label', { useAscii: false, padding: 2 })
    const lines = output.split('\n')

    expect(lines[0]).toBe('◯' + '─'.repeat(16) + '◯')
    expect(lines[lines.length - 1]).toBe('◯' + '─'.repeat(16) + '◯')
    expect(lines.some((l) => l.includes('Longer Label'))).toBe(true)
    for (const line of lines.slice(1, -1)) {
      expect(line.startsWith('│')).toBe(true)
      expect(line.endsWith('│')).toBe(true)
    }
  })
})
