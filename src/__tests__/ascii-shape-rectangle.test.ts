import { describe, it, expect } from 'vitest'
import {
  getBoxDimensions,
  renderBox,
  getBoxAttachmentPoint,
  rectangleRenderer,
} from '../ascii/shapes/rectangle.ts'
import { canvasToString } from '../ascii/canvas.ts'
import { getCorners } from '../ascii/shapes/corners.ts'
import {
  Up,
  Down,
  Left,
  Right,
  UpperLeft,
  UpperRight,
  LowerLeft,
  LowerRight,
  Middle,
} from '../ascii/types.ts'
import type { ShapeRenderOptions } from '../ascii/shapes/types.ts'

const optsP0: ShapeRenderOptions = { useAscii: false, padding: 0 }
const optsP1: ShapeRenderOptions = { useAscii: false, padding: 1 }
const optsAsciiP0: ShapeRenderOptions = { useAscii: true, padding: 0 }

describe('rectangle shape: getBoxDimensions', () => {
  it('sizes a single-line label with zero padding', () => {
    const dims = getBoxDimensions('Hi', optsP0)
    expect(dims.width).toBe(4)
    expect(dims.height).toBe(3)
    expect(dims.labelArea).toEqual({ x: 1, y: 1, width: 2, height: 1 })
    expect(dims.gridColumns).toEqual([1, 2, 1])
    expect(dims.gridRows).toEqual([1, 1, 1])
  })

  it('grows width and height with padding', () => {
    const dims = getBoxDimensions('Hi', optsP1)
    expect(dims.width).toBe(6)
    // rawInnerHeight = 1 + 2*1 = 3 (odd) -> innerHeight stays 3
    expect(dims.height).toBe(5)
    expect(dims.gridColumns).toEqual([1, 4, 1])
    expect(dims.gridRows).toEqual([1, 3, 1])
  })

  it('bumps innerHeight to odd when line count makes it even', () => {
    const dims = getBoxDimensions('One\nTwo', optsP0)
    // lineCount=2, rawInnerHeight=2 (even) -> innerHeight=3
    expect(dims.gridRows).toEqual([1, 3, 1])
    expect(dims.height).toBe(5)
    expect(dims.labelArea.height).toBe(2)
  })

  it('keeps innerHeight odd when line count already makes it odd', () => {
    const dims = getBoxDimensions('One\nTwo\nThree', optsP0)
    // lineCount=3, rawInnerHeight=3 (odd) -> innerHeight stays 3
    expect(dims.gridRows).toEqual([1, 3, 1])
    expect(dims.height).toBe(5)
  })

  it('uses the widest line to size width for multi-line labels', () => {
    const dims = getBoxDimensions('Short\nA much longer line', optsP0)
    const expectedWidth = 'A much longer line'.length + 2
    expect(dims.width).toBe(expectedWidth)
    expect(dims.labelArea.width).toBe('A much longer line'.length)
  })

  it('handles an empty label', () => {
    const dims = getBoxDimensions('', optsP0)
    expect(dims.labelArea.width).toBe(0)
    expect(dims.labelArea.height).toBe(1)
    expect(dims.width).toBe(2)
  })
})

describe('rectangle shape: renderBox', () => {
  it('draws unicode borders and corners for a single-line label', () => {
    const dims = getBoxDimensions('Hi', optsP0)
    const corners = getCorners('rectangle', false)
    const canvas = renderBox('Hi', dims, corners, false)
    const text = canvasToString(canvas)
    expect(text).toContain('┌')
    expect(text).toContain('┐')
    expect(text).toContain('└')
    expect(text).toContain('┘')
    expect(text).toContain('─')
    expect(text).toContain('│')
    expect(text).toContain('Hi')
  })

  it('draws ascii borders and corners for a single-line label', () => {
    const dims = getBoxDimensions('Hi', optsAsciiP0)
    const corners = getCorners('rectangle', true)
    const canvas = renderBox('Hi', dims, corners, true)
    const text = canvasToString(canvas)
    expect(text).toContain('+')
    expect(text).toContain('-')
    expect(text).toContain('|')
    expect(text).not.toContain('┌')
    expect(text).toContain('Hi')
  })

  it('centers a single-line label horizontally and vertically', () => {
    const dims = getBoxDimensions('Hi', optsP1)
    const corners = getCorners('rectangle', false)
    const canvas = renderBox('Hi', dims, corners, false)
    const lines = canvasToString(canvas).split('\n')
    const labelRow = lines.findIndex((l) => l.includes('Hi'))
    expect(labelRow).toBeGreaterThan(0)
    expect(labelRow).toBeLessThan(lines.length - 1)
    const col = lines[labelRow]!.indexOf('Hi')
    expect(col).toBeGreaterThan(0)
  })

  it('stacks a multi-line label across separate rows in order', () => {
    const dims = getBoxDimensions('One\nTwo\nThree', optsP0)
    const corners = getCorners('rectangle', false)
    const canvas = renderBox('One\nTwo\nThree', dims, corners, false)
    const lines = canvasToString(canvas).split('\n')
    const oneRow = lines.findIndex((l) => l.includes('One'))
    const twoRow = lines.findIndex((l) => l.includes('Two'))
    const threeRow = lines.findIndex((l) => l.includes('Three'))
    expect(oneRow).toBeGreaterThan(-1)
    expect(twoRow).toBeGreaterThan(oneRow)
    expect(threeRow).toBeGreaterThan(twoRow)
  })

  it('centers an even number of label lines around the middle row', () => {
    const dims = getBoxDimensions('One\nTwo', optsP0)
    const corners = getCorners('rectangle', false)
    const canvas = renderBox('One\nTwo', dims, corners, false)
    const lines = canvasToString(canvas).split('\n')
    const oneRow = lines.findIndex((l) => l.includes('One'))
    const twoRow = lines.findIndex((l) => l.includes('Two'))
    expect(twoRow).toBe(oneRow + 1)
  })

  it('clips label characters that fall outside the canvas bounds', () => {
    const tinyDims = getBoxDimensions('', optsP0)
    const corners = getCorners('rectangle', false)
    const canvas = renderBox('Hello World', tinyDims, corners, false)
    const text = canvasToString(canvas)
    expect(text).not.toContain('Hello World')
  })

  it('uses custom corner characters when provided', () => {
    const dims = getBoxDimensions('Hi', optsP0)
    const canvas = renderBox(
      'Hi',
      dims,
      { tl: '<', tr: '>', bl: '<', br: '>' },
      false,
    )
    const text = canvasToString(canvas)
    expect(text).toContain('<')
    expect(text).toContain('>')
  })
})

describe('rectangle shape: getBoxAttachmentPoint', () => {
  const dims = getBoxDimensions('Hi', optsP1)
  const base = { x: 10, y: 20 }

  it('returns the top-center point for Up', () => {
    expect(getBoxAttachmentPoint(Up, dims, base)).toEqual({
      x: base.x + Math.floor(dims.width / 2),
      y: base.y,
    })
  })

  it('returns the bottom-center point for Down', () => {
    expect(getBoxAttachmentPoint(Down, dims, base)).toEqual({
      x: base.x + Math.floor(dims.width / 2),
      y: base.y + dims.height - 1,
    })
  })

  it('returns the left-middle point for Left', () => {
    expect(getBoxAttachmentPoint(Left, dims, base)).toEqual({
      x: base.x,
      y: base.y + Math.floor(dims.height / 2),
    })
  })

  it('returns the right-middle point for Right', () => {
    expect(getBoxAttachmentPoint(Right, dims, base)).toEqual({
      x: base.x + dims.width - 1,
      y: base.y + Math.floor(dims.height / 2),
    })
  })

  it('returns the top-left corner for UpperLeft', () => {
    expect(getBoxAttachmentPoint(UpperLeft, dims, base)).toEqual({
      x: base.x,
      y: base.y,
    })
  })

  it('returns the top-right corner for UpperRight', () => {
    expect(getBoxAttachmentPoint(UpperRight, dims, base)).toEqual({
      x: base.x + dims.width - 1,
      y: base.y,
    })
  })

  it('returns the bottom-left corner for LowerLeft', () => {
    expect(getBoxAttachmentPoint(LowerLeft, dims, base)).toEqual({
      x: base.x,
      y: base.y + dims.height - 1,
    })
  })

  it('returns the bottom-right corner for LowerRight', () => {
    expect(getBoxAttachmentPoint(LowerRight, dims, base)).toEqual({
      x: base.x + dims.width - 1,
      y: base.y + dims.height - 1,
    })
  })

  it('falls back to the center point for Middle', () => {
    expect(getBoxAttachmentPoint(Middle, dims, base)).toEqual({
      x: base.x + Math.floor(dims.width / 2),
      y: base.y + Math.floor(dims.height / 2),
    })
  })
})

describe('rectangleRenderer', () => {
  it('delegates getDimensions to getBoxDimensions', () => {
    expect(rectangleRenderer.getDimensions('Hi', optsP0)).toEqual(
      getBoxDimensions('Hi', optsP0),
    )
  })

  it('renders unicode rectangle corners by default', () => {
    const dims = rectangleRenderer.getDimensions('Hi', optsP0)
    const canvas = rectangleRenderer.render('Hi', dims, optsP0)
    const text = canvasToString(canvas)
    expect(text).toContain('┌')
    expect(text).toContain('┘')
  })

  it('renders ascii rectangle corners when useAscii is set', () => {
    const dims = rectangleRenderer.getDimensions('Hi', optsAsciiP0)
    const canvas = rectangleRenderer.render('Hi', dims, optsAsciiP0)
    const text = canvasToString(canvas)
    expect(text).toContain('+')
    expect(text).not.toContain('┌')
  })

  it('delegates getAttachmentPoint to getBoxAttachmentPoint', () => {
    const dims = rectangleRenderer.getDimensions('Hi', optsP0)
    const base = { x: 3, y: 4 }
    expect(rectangleRenderer.getAttachmentPoint(Down, dims, base)).toEqual(
      getBoxAttachmentPoint(Down, dims, base),
    )
  })
})
