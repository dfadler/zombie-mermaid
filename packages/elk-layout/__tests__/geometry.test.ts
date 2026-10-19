import { describe, expect, it } from 'vitest'
import { layoutFlowchart } from '../src/index.ts'
import { buildModel } from '../src/model.ts'

describe('elk-layout node sizing', () => {
  const size = (src: string) => {
    const n = buildModel(`flowchart TD\n  ${src}`).nodes[0]!
    return [n.kind, n.w, n.h] as const
  }
  // Constants are fitted to mermaid's oracle (see model.ts); pin each shape's formula.
  it.each([
    ['A[Hi]', 'rect'],
    ['A(Hi)', 'round'],
    ['A([Hi])', 'stadium'],
    ['A((Hi))', 'circle'],
    ['A(((Hi)))', 'double'],
    ['A{{Hi}}', 'hex'],
    ['A[[Hi]]', 'subr'],
    ['A[(Hi)]', 'cyl'],
    ['A{Hi}', 'diamond'],
  ])('%s is sized as a %s', (src, kind) => {
    const [k, w, h] = size(src)
    expect(k).toBe(kind)
    expect(w).toBeGreaterThan(0)
    expect(h).toBeGreaterThan(0)
    if (kind === 'circle' || kind === 'double' || kind === 'diamond')
      expect(w).toBe(h)
  })

  it('uses the wrapped-label constants for multi-line stadium and hexagon', () => {
    const long = 'word '.repeat(12).trim()
    expect(size(`A([${long}])`)[1]).toBe(126.3 + 52)
    expect(size(`A{{${long}}}`)[1]).toBe(219.4)
    expect(size('A{{Hi}}')[1]).toBe(205.7)
  })
})

describe('elk-layout edge geometry', () => {
  it('attaches edges to a diamond outline, not its bounding box', async () => {
    const l = await layoutFlowchart(
      'flowchart TD\n  A{Decide} --> B((Go))\n  A --> C(Stop)\n  B --> D[(DB)]\n  C --> D\n  D --> A',
    )
    const byId = new Map(l.nodes.map((n) => [n.id, n]))
    for (const e of l.edges) {
      const f = byId.get(e.from)!
      const t = byId.get(e.to)!
      const a = e.pts[0]!
      const z = e.pts[e.pts.length - 1]!
      expect(Math.abs(a[0] - f.x)).toBeLessThanOrEqual(f.w / 2 + 0.5)
      expect(Math.abs(a[1] - f.y)).toBeLessThanOrEqual(f.h / 2 + 0.5)
      expect(Math.abs(z[0] - t.x)).toBeLessThanOrEqual(t.w / 2 + 0.5)
      expect(Math.abs(z[1] - t.y)).toBeLessThanOrEqual(t.h / 2 + 0.5)
    }
    const dia = byId.get('A')!
    const start = l.edges.find((e) => e.from === 'A')!.pts[0]!
    const k =
      Math.abs(start[0] - dia.x) / (dia.w / 2) +
      Math.abs(start[1] - dia.y) / (dia.h / 2)
    expect(k).toBeLessThanOrEqual(1.01)
  })

  it('lays out bidirectional, open and labelled edges', async () => {
    const l = await layoutFlowchart(
      'flowchart LR\n  A <--> B\n  B --- C\n  C -->|yes| D\n  A --> D\n  A --> C\n  A --> E\n  E --> D',
    )
    expect(l.dir).toBe('LR')
    expect(l.edges).toHaveLength(7)
    const yes = l.edges.find((e) => e.label === 'yes')!
    expect(yes.lw).toBeGreaterThan(0)
    for (const e of l.edges) expect(e.pts.length).toBeGreaterThanOrEqual(2)
  })
})
