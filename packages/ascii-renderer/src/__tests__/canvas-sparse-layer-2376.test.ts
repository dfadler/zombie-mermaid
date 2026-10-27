import { describe, it, expect } from 'vitest'
import {
  cellAt,
  copyCanvas,
  drawText,
  getCanvasSize,
  mergeCanvases,
  mkCanvas,
  write,
} from '../canvas.ts'

describe('copyCanvas sparse layers (#2376)', () => {
  it('keeps the source size and stores written cells off the columns', () => {
    const layer = copyCanvas(mkCanvas(9, 99))
    write(layer, 0, 40, '│')
    write(layer, 3, 5, '─')
    expect(getCanvasSize(layer)).toEqual([9, 99])
    expect(cellAt(layer, 0, 40)).toBe('│')
    expect(cellAt(layer, 3, 5)).toBe('─')
    // Columns stay the shared blank full-height column.
    expect(layer[0]![40]).toBe(' ')
    expect(layer[5]!.length).toBe(100)
    expect(layer[0]).toBe(layer[6])
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
