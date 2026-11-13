/**
 * #2740: mermaid@12.3.0 draws a flowchart self-loop on the node's left face
 * in TD/BT and its top face in LR/RL (20px bulge, label outside the bulge,
 * repeated loops stacked outward). Measured via scripts/lib/real-mermaid.ts.
 */
import { describe, expect, it } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { layoutGraphSync } from '../layout-engine.ts'

const lay = (src: string) => layoutGraphSync(parseMermaid(src))
const loops = (g: ReturnType<typeof lay>) =>
  g.edges.filter((e) => e.source === 'a' && e.target === 'a')

describe.each([
  ['TD', 'x', false],
  ['BT', 'x', true],
  ['LR', 'y', false],
  ['RL', 'y', true],
] as const)('self-loop face (%s)', (dir, axis, reversed) => {
  const along = axis === 'x' ? 'y' : 'x'
  const src = (extra = '') =>
    `flowchart ${dir}\n  a --> b\n  a -->${extra} a\n  b --> c`

  it('bulges 20px past the low-side face and runs with the flow order', () => {
    const g = lay(src())
    const a = g.nodes.find((n) => n.id === 'a')!
    const [loop] = loops(g)
    const face = a[axis]
    const pts = loop!.points
    expect(Math.min(...pts.map((p) => p[axis]))).toBeCloseTo(face - 20, 5)
    expect(Math.max(...pts.map((p) => p[axis]))).toBeCloseTo(face, 5)
    const first = pts[0]![along]
    const last = pts[pts.length - 1]![along]
    expect(reversed ? first > last : first < last).toBe(true)
  })

  it('puts the label outside the bulge and pushes the next loop past it', () => {
    const g = lay(`flowchart ${dir}\n  a -->|one| a\n  a --> a\n  a --> b`)
    const a = g.nodes.find((n) => n.id === 'a')!
    const [first, second] = loops(g)
    const apex = (e: NonNullable<typeof first>) =>
      Math.min(...e.points.map((p) => p[axis]))
    expect(first!.labelPosition![axis]).toBeLessThan(apex(first!))
    expect(apex(second!)).toBeLessThan(first!.labelPosition![axis])
    expect(apex(first!)).toBeCloseTo(a[axis] - 20, 5)
  })
})

describe('self-loop on a diamond (#2740)', () => {
  it('reaches the diamond outline, not the bounding-box face', () => {
    const g = lay('flowchart LR\n  a{d} --> a\n  a --> b')
    const a = g.nodes.find((n) => n.id === 'a')!
    const [loop] = loops(g)
    const start = loop!.points[0]!
    // Left half of the top-left slanted edge: |dx|/halfW + |dy|/halfH = 1.
    const cx = a.x + a.width / 2
    const cy = a.y + a.height / 2
    const onOutline =
      Math.abs(start.x - cx) / (a.width / 2) +
      Math.abs(start.y - cy) / (a.height / 2)
    expect(onOutline).toBeCloseTo(1, 1)
  })
})
