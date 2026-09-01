/**
 * Unit tests for the shared ELK edge-geometry extraction helpers
 * (`extractEdgePoints` / `extractEdgeLabelPosition`).
 *
 * `from-elk.ts`, `class/layout.ts`, and `er/layout.ts` all exercise this
 * module indirectly through full-diagram integration tests, but those
 * only ever hit the "happy path" (an edge with sections and, sometimes,
 * a placed label). These tests cover the defensive branches directly —
 * missing/empty sections, missing/empty labels, an unplaced label, and
 * missing bend points/label dimensions — so every branch has direct
 * coverage rather than relying on an integration test to happen to hit it.
 */
import { describe, it, expect } from 'vitest'
import type { ElkExtendedEdge } from 'elkjs'
import {
  extractEdgePoints,
  extractEdgeLabelPosition,
} from '../layout-engine/elk-adapter-utils.ts'

function edge(partial: Partial<ElkExtendedEdge>): ElkExtendedEdge {
  return { id: 'e0', sources: ['a'], targets: ['b'], ...partial }
}

describe('extractEdgePoints', () => {
  it('returns an empty array when the edge has no sections property', () => {
    expect(extractEdgePoints(edge({}))).toEqual([])
  })

  it('returns an empty array when sections is an empty array', () => {
    expect(extractEdgePoints(edge({ sections: [] }))).toEqual([])
  })

  it('walks start -> end with no bend points', () => {
    const e = edge({
      sections: [
        {
          id: 's0',
          startPoint: { x: 10, y: 20 },
          endPoint: { x: 30, y: 40 },
        },
      ],
    })
    expect(extractEdgePoints(e)).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ])
  })

  it('walks start -> bendPoints -> end when bend points are present', () => {
    const e = edge({
      sections: [
        {
          id: 's0',
          startPoint: { x: 0, y: 0 },
          endPoint: { x: 100, y: 0 },
          bendPoints: [
            { x: 25, y: 50 },
            { x: 75, y: 50 },
          ],
        },
      ],
    })
    expect(extractEdgePoints(e)).toEqual([
      { x: 0, y: 0 },
      { x: 25, y: 50 },
      { x: 75, y: 50 },
      { x: 100, y: 0 },
    ])
  })

  it('translates every point by offsetX/offsetY when provided', () => {
    const e = edge({
      sections: [
        {
          id: 's0',
          startPoint: { x: 0, y: 0 },
          endPoint: { x: 10, y: 10 },
          bendPoints: [{ x: 5, y: 5 }],
        },
      ],
    })
    expect(extractEdgePoints(e, 100, 200)).toEqual([
      { x: 100, y: 200 },
      { x: 105, y: 205 },
      { x: 110, y: 210 },
    ])
  })

  it('only reads the first section when multiple are present', () => {
    const e = edge({
      sections: [
        { id: 's0', startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } },
        { id: 's1', startPoint: { x: 9, y: 9 }, endPoint: { x: 8, y: 8 } },
      ],
    })
    expect(extractEdgePoints(e)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ])
  })
})

describe('extractEdgeLabelPosition', () => {
  it('returns undefined when the edge has no labels property', () => {
    expect(extractEdgeLabelPosition(edge({}))).toBeUndefined()
  })

  it('returns undefined when labels is an empty array', () => {
    expect(extractEdgeLabelPosition(edge({ labels: [] }))).toBeUndefined()
  })

  it('returns undefined when the label has no x/y (ELK left it unplaced)', () => {
    expect(
      extractEdgeLabelPosition(edge({ labels: [{ text: 'foo' }] })),
    ).toBeUndefined()
  })

  it('returns undefined when only x is set (y still unplaced)', () => {
    expect(
      extractEdgeLabelPosition(edge({ labels: [{ text: 'foo', x: 5 }] })),
    ).toBeUndefined()
  })

  it('computes the label center, defaulting missing width/height to 0', () => {
    expect(
      extractEdgeLabelPosition(
        edge({ labels: [{ text: 'foo', x: 10, y: 20 }] }),
      ),
    ).toEqual({ x: 10, y: 20 })
  })

  it('computes the label center from x/y/width/height', () => {
    expect(
      extractEdgeLabelPosition(
        edge({
          labels: [{ text: 'foo', x: 10, y: 20, width: 40, height: 10 }],
        }),
      ),
    ).toEqual({ x: 30, y: 25 })
  })

  it('translates the computed center by offsetX/offsetY when provided', () => {
    expect(
      extractEdgeLabelPosition(
        edge({
          labels: [{ text: 'foo', x: 10, y: 20, width: 40, height: 10 }],
        }),
        100,
        200,
      ),
    ).toEqual({ x: 130, y: 225 })
  })

  it('only reads the first label when multiple are present', () => {
    expect(
      extractEdgeLabelPosition(
        edge({
          labels: [
            { text: 'first', x: 0, y: 0 },
            { text: 'second', x: 100, y: 100 },
          ],
        }),
      ),
    ).toEqual({ x: 0, y: 0 })
  })
})
