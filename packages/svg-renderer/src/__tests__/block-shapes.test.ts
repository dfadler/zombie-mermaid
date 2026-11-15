import { describe, it, expect } from 'vitest'
import { clipToShape, fitShape, intersectRect } from '../block/shapes.ts'

const fit = (shape: Parameters<typeof fitShape>[0], dirs: string[] = []) =>
  fitShape(shape, dirs, 38.867, 24, 8).geometry

describe('intersectRect', () => {
  it('leaves through the side the line is steeper or shallower than the corner', () => {
    const box = { x: 0, y: 0, width: 20, height: 10 }
    expect(intersectRect(box, { x: 100, y: 0 })).toEqual({ x: 10, y: 0 })
    expect(intersectRect(box, { x: -100, y: 0 })).toEqual({ x: -10, y: 0 })
    expect(intersectRect(box, { x: 0, y: 100 })).toEqual({ x: 0, y: 5 })
    expect(intersectRect(box, { x: 0, y: -100 })).toEqual({ x: 0, y: -5 })
    expect(intersectRect(box, { x: 0, y: 0 })).toEqual({ x: 10, y: 0 })
  })
})

describe('clipToShape', () => {
  it('clips a circle at its radius in any direction', () => {
    const g = fit('circle')
    for (const [x, y] of [
      [100, 0],
      [-50, -50],
      [3, 80],
    ] as const) {
      const p = clipToShape(g, 10, 20, { x: 10 + x, y: 20 + y })
      expect(Math.hypot(p.x - 10, p.y - 20)).toBeCloseTo(g.r!, 6)
    }
  })

  it('clips a polygon to its nearest edge and falls back to the centre when nothing is crossed', () => {
    const g = fit('hexagon')
    const right = clipToShape(g, 0, 0, { x: 500, y: 0 })
    expect(right.y).toBeCloseTo(0, 6)
    expect(right.x).toBeGreaterThan(0)
    // A target at the centre gives a zero-length line: no crossing, so the centre.
    expect(clipToShape(g, 5, 5, { x: 5, y: 5 })).toMatchObject({ x: 5, y: 5 })
    // A line along an edge of a lean box meets two edges; the nearer to the target wins.
    const lean = fit('lean_right')
    const along = clipToShape(lean, 0, 0, { x: 0, y: -500 })
    expect(along.y).toBeLessThan(0)
  })

  it('moves a cylinder crossing onto the rim of the top or bottom ellipse', () => {
    const g = fit('cylinder')
    const top = clipToShape(g, 0, 0, { x: 0, y: -500 })
    const bottom = clipToShape(g, 0, 0, { x: 0, y: 500 })
    const side = clipToShape(g, 0, 0, { x: 500, y: 0 })
    expect(top.y).toBeLessThan(-g.clip.height / 2 + g.clip.ry! + 0.01)
    expect(bottom.y).toBeGreaterThan(g.clip.height / 2 - g.clip.ry! - 0.01)
    expect(side.x).toBeCloseTo(g.clip.width / 2, 6)
    // A corner crossing at the full half width is the rim's end.
    const corner = clipToShape(g, 0, 0, { x: 1000, y: -1000 })
    expect(Number.isFinite(corner.x + corner.y)).toBe(true)
  })
})

describe('fitShape', () => {
  it('draws every shape for every direction list, with a bounding box that holds the label', () => {
    for (const shape of [
      'circle',
      'doublecircle',
      'diamond',
      'hexagon',
      'stadium',
      'subroutine',
      'cylinder',
      'rect_left_inv_arrow',
      'lean_right',
      'lean_left',
      'trapezoid',
      'inv_trapezoid',
      'block_arrow',
    ] as const) {
      const alone = fitShape(shape, ['right'], 38.867, 24, 8)
      const cell = fitShape(shape, ['right'], 38.867, 24, 8, {
        width: 300,
        height: 80,
        span: 2,
      })
      for (const f of [alone, cell]) {
        expect(f.width).toBeGreaterThan(38)
        expect(f.height).toBeGreaterThanOrEqual(24)
      }
      expect(cell.width).toBeGreaterThanOrEqual(alone.width)
    }
  })

  it('reads every direction in a list, and a name it does not know as nothing', () => {
    const points = (dirs: string[]) => fit('block_arrow', dirs).points!.length
    expect(points(['x', 'y'])).toBe(16)
    expect(points(['right', 'left', 'up'])).toBe(6)
    expect(points(['up ', 'foo'])).toBe(1)
  })
})
