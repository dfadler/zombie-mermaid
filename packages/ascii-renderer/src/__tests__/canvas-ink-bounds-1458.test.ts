import { describe, it, expect } from 'vitest'
import {
  copyCanvas,
  drawText,
  mkCanvas,
  mergeCanvases,
  scanBounds,
  write,
} from '../canvas.ts'

describe('copyCanvas ink bounds (#1458)', () => {
  it('a blank layer scans nothing', () => {
    const [x0, y0, x1, y1] = scanBounds(copyCanvas(mkCanvas(9, 9)))
    expect(x0 > x1 || y0 > y1).toBe(true)
  })

  it('write and drawText widen the scanned box', () => {
    const c = copyCanvas(mkCanvas(9, 9))
    write(c, 2, 3, 'x')
    drawText(c, { x: 4, y: 6 }, 'ab')
    expect(scanBounds(c)).toEqual([2, 3, 5, 6])
  })

  it('a write to one layer never shows up in another or in a later copy (shared blank columns)', () => {
    const a = copyCanvas(mkCanvas(4, 4))
    const b = copyCanvas(mkCanvas(4, 4))
    write(a, 1, 2, 'a')
    drawText(a, { x: 2, y: 3 }, 'hi')
    expect(b.every((col) => col.every((ch) => ch === ' '))).toBe(true)
    expect(copyCanvas(mkCanvas(4, 4))[1]![2]).toBe(' ')
    expect([a[1]![2], a[2]![3], a[3]![3]]).toEqual(['a', 'h', 'i'])
  })

  it('a layer grown by drawText keeps its writes and stays independent', () => {
    const a = copyCanvas(mkCanvas(2, 2))
    drawText(a, { x: 1, y: 1 }, 'abcd')
    expect(
      a
        .map((col) => col[1])
        .join('')
        .trim(),
    ).toBe('abcd')
    expect(copyCanvas(mkCanvas(2, 2)).flat().join('').trim()).toBe('')
  })

  it('merge still applies every written cell of a layer', () => {
    const layer = copyCanvas(mkCanvas(9, 9))
    write(layer, 9, 9, 'z')
    write(layer, 0, 0, 'a')
    const merged = mergeCanvases(mkCanvas(9, 9), { x: 0, y: 0 }, false, layer)
    expect([merged[0]![0], merged[9]![9]]).toEqual(['a', 'z'])
  })
})
