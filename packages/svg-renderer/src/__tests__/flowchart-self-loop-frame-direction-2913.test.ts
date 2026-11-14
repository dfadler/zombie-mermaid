/**
 * #2913: mermaid@12.3.0 draws a self-loop by the direction its node is laid out
 * in: the node's innermost frame with a `direction` that applies, else the
 * diagram's. TD/BT put the loop on the left face, LR/RL on the top face (#2740).
 * Measured via scripts/lib/real-mermaid.ts: every root (TD, BT, LR, RL) with a
 * `direction LR` or `RL` frame draws it over the top, and with a `direction TD`
 * or `BT` frame draws it on the left; a nested frame without its own direction
 * follows its parent's; a frame an outside edge crosses ignores its direction.
 */
import { describe, expect, it } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { layoutGraphSync } from '../layout-engine.ts'

const lay = (src: string) => layoutGraphSync(parseMermaid(src))

/** Which face of `b` its first self-loop bulges out of. */
const face = (src: string): 'top' | 'left' => {
  const g = lay(src)
  const b = g.nodes.find((n) => n.id === 'b')!
  const [loop] = g.edges.filter((e) => e.source === 'b' && e.target === 'b')
  const xs = loop!.points.map((p) => p.x)
  const ys = loop!.points.map((p) => p.y)
  const top = b.y - Math.min(...ys)
  const left = b.x - Math.min(...xs)
  expect(Math.max(top, left)).toBeCloseTo(20, 5)
  return top > left ? 'top' : 'left'
}

const frame = (root: string, inner: string) =>
  `flowchart ${root}\n  subgraph S\n    direction ${inner}\n    a --> b\n    b --> b\n  end`

describe('self-loop face follows the frame direction (#2913)', () => {
  describe.each(['TD', 'BT', 'LR', 'RL'])('root %s', (root) => {
    it.each([
      ['LR', 'top'],
      ['RL', 'top'],
      ['TB', 'left'],
      ['BT', 'left'],
    ] as const)('frame direction %s draws the loop on the %s', (inner, want) => {
      expect(face(frame(root, inner))).toBe(want)
    })

    it('keeps the diagram direction without a frame', () => {
      const want = root === 'LR' || root === 'RL' ? 'top' : 'left'
      expect(face(`flowchart ${root}\n  a --> b\n  b --> b`)).toBe(want)
    })
  })

  it('a nested frame without a direction follows its parent', () => {
    const src = (inner: string) =>
      `flowchart TD\n  subgraph O\n    direction LR\n    subgraph I\n${inner}      a --> b\n      b --> b\n    end\n  end`
    expect(face(src(''))).toBe('top')
    expect(face(src('      direction TB\n'))).toBe('left')
  })

  it('a frame an outside edge crosses ignores its direction', () => {
    expect(
      face(
        'flowchart TD\n  x --> b\n  subgraph S\n    direction LR\n    a --> b\n    b --> b\n  end',
      ),
    ).toBe('left')
  })

  it('pins the loop points of the issue sample', () => {
    const g = lay(frame('TD', 'LR'))
    const b = g.nodes.find((n) => n.id === 'b')!
    const [loop] = g.edges.filter((e) => e.source === 'b')
    expect(
      loop!.points.map((p) => [p.x - b.x, p.y - b.y].map(Math.round)),
    ).toMatchInlineSnapshot(`
      [
        [
          55,
          0,
        ],
        [
          55,
          -20,
        ],
        [
          97,
          -20,
        ],
        [
          97,
          0,
        ],
      ]
    `)
  })
})
