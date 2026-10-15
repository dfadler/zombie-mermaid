/**
 * #2110: `alignLayerNodes` moves an edge's end point with its snapped node. The
 * leg after it follows when collinear; a cross-flow run too close to the moved
 * node is pushed back to leave `MIN_STUB` (12 px). Points are written for TD
 * (flow axis y) and transposed for LR.
 */
import { describe, it, expect } from 'vitest'
import type { Direction, PositionedEdge } from '@zombie-mermaid/core'
import { alignLayerNodes } from '../layout-engine/layer-alignment.ts'

type Pt = [x: number, y: number]
const MIN_STUB = 12

// P (flow pos 100) and Q (110) share a layer and snap to 105: P +5, Q -5.
function run(dir: Direction, pts: Pt[], end: 'source' | 'target'): Pt[] {
  const h = dir === 'LR'
  const node = (id: string, flow: number) => ({
    id,
    label: id,
    shape: 'rectangle' as const,
    x: h ? flow : 0,
    y: h ? 0 : flow,
    width: 40,
    height: 20,
  })
  const edge = {
    source: end === 'source' ? 'P' : 'S',
    target: end === 'source' ? 'T' : 'Q',
    style: 'solid',
    hasArrowStart: false,
    hasArrowEnd: true,
    points: pts.map(([x, y]) => (h ? { x: y, y: x } : { x, y })),
  } as PositionedEdge
  const nodes = [node('P', 100), node('Q', 110), node('S', 0), node('T', 300)]
  alignLayerNodes(nodes, [edge], dir)
  return edge.points.map((p) => (h ? [p.y, p.x] : [p.x, p.y]) as Pt)
}

describe.each<Direction>(['TD', 'LR'])('alignLayerNodes stubs (%s)', (dir) => {
  describe('source end (P moves +5)', () => {
    it('moves a collinear second point with the node', () => {
      const out = run(
        dir,
        [
          [10, 100],
          [10, 100],
          [10, 200],
        ],
        'source',
      )
      expect(out.slice(0, 2)).toEqual([
        [10, 105],
        [10, 105],
      ])
    })

    it('pushes a bend run back to leave a full stub', () => {
      const out = run(
        dir,
        [
          [10, 100],
          [10, 103],
          [40, 103],
          [40, 200],
        ],
        'source',
      )
      expect(out[0]![1]).toBe(105)
      expect(out[1]![1]).toBe(105 + MIN_STUB)
      expect(out[2]![1]).toBe(105 + MIN_STUB)
    })

    it('keeps the run when pushing it would reverse the next leg', () => {
      const out = run(
        dir,
        [
          [10, 100],
          [10, 103],
          [40, 103],
          [40, 110],
        ],
        'source',
      )
      expect(out).toEqual([
        [10, 105],
        [10, 103],
        [40, 103],
        [40, 110],
      ])
    })

    it('leaves a non-collinear bend alone', () => {
      const out = run(
        dir,
        [
          [10, 100],
          [10, 150],
          [40, 180],
          [40, 200],
        ],
        'source',
      )
      expect(out).toEqual([
        [10, 105],
        [10, 150],
        [40, 180],
        [40, 200],
      ])
    })

    it('ignores an edge with a single point', () => {
      expect(run(dir, [[10, 100]], 'source')).toEqual([[10, 100]])
    })

    it('moves only the end of a two-point edge', () => {
      const out = run(
        dir,
        [
          [10, 100],
          [10, 150],
        ],
        'source',
      )
      expect(out).toEqual([
        [10, 105],
        [10, 150],
      ])
    })

    it('leaves a three-point edge with no run alone', () => {
      const out = run(
        dir,
        [
          [10, 100],
          [10, 150],
          [40, 150],
        ],
        'source',
      )
      expect(out).toEqual([
        [10, 105],
        [10, 150],
        [40, 150],
      ])
    })
  })

  describe('target end (Q moves -5)', () => {
    it('moves a collinear previous point with the node', () => {
      const out = run(
        dir,
        [
          [10, 0],
          [10, 110],
          [10, 110],
        ],
        'target',
      )
      expect(out.slice(1)).toEqual([
        [10, 105],
        [10, 105],
      ])
    })

    it('pushes a bend run back to leave a full stub', () => {
      const out = run(
        dir,
        [
          [0, 0],
          [0, 100],
          [10, 100],
          [10, 110],
        ],
        'target',
      )
      expect(out[3]![1]).toBe(105)
      expect(out[2]![1]).toBe(105 - MIN_STUB)
      expect(out[1]![1]).toBe(105 - MIN_STUB)
    })

    it('keeps the run when pushing it would reverse the previous leg', () => {
      const out = run(
        dir,
        [
          [0, 98],
          [0, 100],
          [10, 100],
          [10, 110],
        ],
        'target',
      )
      expect(out).toEqual([
        [0, 98],
        [0, 100],
        [10, 100],
        [10, 105],
      ])
    })

    it('leaves a non-collinear bend alone', () => {
      const out = run(
        dir,
        [
          [0, 0],
          [0, 20],
          [10, 60],
          [10, 110],
        ],
        'target',
      )
      expect(out).toEqual([
        [0, 0],
        [0, 20],
        [10, 60],
        [10, 105],
      ])
    })
  })
})
