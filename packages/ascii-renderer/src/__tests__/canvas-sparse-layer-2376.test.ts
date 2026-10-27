import { describe, it, expect } from 'vitest'
import {
  copyCanvas,
  drawText,
  getCanvasSize,
  mergeCanvases,
  mkCanvas,
  write,
} from '../canvas.ts'

describe('copyCanvas sparse layers (#2376)', () => {
  it('keeps the source size and allocates only the cells written', () => {
    const layer = copyCanvas(mkCanvas(9, 99))
    write(layer, 0, 40, '│')
    write(layer, 3, 5, '─')
    expect(getCanvasSize(layer)).toEqual([9, 99])
    // Written columns hold up to the last written row, not the full height.
    expect(layer[0]!.length).toBe(41)
    expect(layer[3]!.length).toBe(6)
    // Untouched columns stay the shared blank full-height column.
    expect(layer[5]!.length).toBe(100)
    expect(layer[5]).toBe(layer[6])
  })

  it('merges only drawn cells and treats holes as blanks', () => {
    const layer = copyCanvas(mkCanvas(4, 9))
    write(layer, 1, 7, 'x')
    const merged = mergeCanvases(mkCanvas(4, 9), { x: 0, y: 0 }, false, layer)
    expect(merged[1]![7]).toBe('x')
    expect(merged[1]![6]).toBe(' ')
    expect(merged[0]![0]).toBe(' ')
  })

  it('drawText past the layer bounds grows it and keeps its size', () => {
    const layer = copyCanvas(mkCanvas(2, 2))
    drawText(layer, { x: 1, y: 1 }, 'abcd')
    expect(getCanvasSize(layer)).toEqual([5, 2])
    const merged = mergeCanvases(mkCanvas(5, 2), { x: 0, y: 0 }, false, layer)
    expect([1, 2, 3, 4].map((x) => merged[x]![1])).toEqual(['a', 'b', 'c', 'd'])
  })
})
