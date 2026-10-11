import { describe, it, expect } from 'vitest'
import { copyCanvas, drawText, mkCanvas, write } from '../canvas.ts'

describe('copyCanvas sparse layers (#1478)', () => {
  it('shares blank columns until written, and a write never leaks to siblings', () => {
    const a = copyCanvas(mkCanvas(4, 4))
    const b = copyCanvas(mkCanvas(4, 4))
    expect(a[1]).toBe(a[2])
    write(a, 1, 2, 'x')
    drawText(a, { x: 3, y: 0 }, 'hi')
    expect(a[1]![2]).toBe('x')
    expect([a[3]![0], a[4]![0]]).toEqual(['h', 'i'])
    expect(a[2]!.every((c) => c === ' ')).toBe(true)
    expect(b.every((col) => col.every((c) => c === ' '))).toBe(true)
  })
})
