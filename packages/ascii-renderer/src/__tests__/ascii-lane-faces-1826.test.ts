/**
 * Parallel lanes past the three cells of a default box face (#1826, absorbing
 * #1743 and #1689): the box grows so every lane keeps an arrowhead of its own.
 * Plain groups of 5+ and a reciprocal folded into an LR group (the same face
 * count) lengthen the face in `assignParallelEdgeLanes` (edge-routing.ts);
 * cluster exit siblings, up to six, take both side faces of the target in
 * `laneSide` (cluster-boundary.ts).
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidASCII } from '../index.ts'
import { convertToAsciiGraph } from '../converter.ts'
import { createMapping } from '../grid.ts'
import {
  clusterLaneEndShift,
  clusterLaneSideRoute,
} from '../cluster-boundary.ts'
import {
  checkAll,
  toGrid,
  type Rule,
} from '../../../../__tests__/helpers/ascii-invariants.ts'

const LABELS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
]
type Dir = 'TD' | 'LR' | 'BT' | 'RL'
const render = (src: string, useAscii = false): string =>
  renderMermaidASCII(src, { colorMode: 'none', useAscii })

const plain = (dir: Dir, n: number, label = true): string =>
  `flowchart ${dir}\n` +
  Array.from(
    { length: n },
    (_, i) => `  A -->${label ? `|${LABELS[i]}|` : ''} B`,
  ).join('\n')

const cluster = (dir: Dir, n: number): string =>
  `flowchart ${dir}
  subgraph S [Cluster]
    a
  end
  Start --> S
${Array.from({ length: n }, (_, i) => `  S -->|${i + 1}| T`).join('\n')}
  S -->|other| U`

const HEADS = /[▲▼◄►]/g
const heads = (out: string): number => (out.match(HEADS) ?? []).length

/** Arrowhead cells as `glyph@row` (side faces) or `glyph@col` (top/bottom). */
function headCells(out: string, glyphs: string, axis: 'row' | 'col'): string[] {
  const cells: string[] = []
  toGrid(out).forEach((line, y) =>
    [...line].forEach((ch, x) => {
      if (glyphs.includes(ch)) cells.push(`${ch}@${axis === 'row' ? y : x}`)
    }),
  )
  return cells
}

const violations = (out: string, skip: Rule[] = []): string[] =>
  checkAll(out, { unicode: true, skip }).map((v) => v.message)

describe('plain parallel lanes past a three-cell face (#1743, #1826)', () => {
  it.each([5, 6, 7, 8] as const)(
    'TD: %i labeled lanes each get an arrowhead on its own row',
    (n) => {
      const out = render(plain('TD', n))
      expect(violations(out)).toEqual([])
      // The first edge enters the top; the other n - 1 stack on the right face.
      const sides = headCells(out, '◄', 'row')
      expect(sides).toHaveLength(n - 1)
      expect(new Set(sides).size).toBe(n - 1)
      expect(heads(out)).toBe(n)
    },
  )

  it.each([5, 6, 7])(
    'LR: %i labeled lanes each get an arrowhead in its own column',
    (n) => {
      const out = render(plain('LR', n))
      expect(violations(out)).toEqual([])
      const bottoms = headCells(out, '▲', 'col')
      expect(bottoms).toHaveLength(n - 1)
      expect(new Set(bottoms).size).toBe(n - 1)
    },
  )

  it.each(['BT', 'RL'] as const)(
    '%s: five lanes keep an arrowhead each',
    (dir) => {
      const out = render(plain(dir, 5))
      expect(violations(out)).toEqual([])
      expect(heads(out)).toBe(5)
    },
  )

  it('unlabeled and ASCII-charset lanes size the same way', () => {
    expect(heads(render(plain('TD', 6, false)))).toBe(6)
    const ascii = render(plain('TD', 6), true)
    expect(ascii.split('\n').filter((l) => l.includes('<'))).toHaveLength(5)
  })

  it('four lanes keep the default box; five lengthen the face by one cell', () => {
    const face = (n: number): number => {
      const graph = convertToAsciiGraph(parseMermaid(plain('TD', n)), {
        useAscii: false,
        paddingX: 6,
        paddingY: 5,
        boxBorderPadding: 1,
        graphDirection: 'TD',
      })
      createMapping(graph)
      const a = graph.nodes.find((node) => node.name === 'A')!
      return graph.rowHeight.get(a.gridCoord!.y + 1)!
    }
    expect([face(4), face(5), face(7)]).toEqual([3, 4, 6])
  })
})

describe('a reciprocal folded into an LR group (#1826)', () => {
  const mix = (dir: Dir, fw: number, bw: number): string =>
    `flowchart ${dir}\n` +
    Array.from({ length: fw }, (_, i) => `  A -->|f${i}| B`).join('\n') +
    '\n' +
    Array.from({ length: bw }, (_, i) => `  B -->|back${i}| A`).join('\n')

  it.each([
    [3, 2],
    [2, 3],
    [1, 4],
    [4, 3],
    [5, 2],
  ] as const)(
    'LR: %i forward and %i back keep one arrowhead each',
    (fw, bw) => {
      for (const dir of ['LR', 'RL'] as const) {
        const out = render(mix(dir, fw, bw))
        expect(violations(out)).toEqual([])
        expect(heads(out)).toBe(fw + bw)
      }
    },
  )
})

describe('cluster exit siblings past the fifth (#1689, #1826)', () => {
  it.each([5, 6, 7] as const)(
    'TD: %i siblings each enter T on a row of their own',
    (n) => {
      const out = render(cluster('TD', n))
      expect(violations(out)).toEqual([])
      // Sibling 1 drops into the top; the rest take rows of the two side faces.
      const high = headCells(out, '◄', 'row')
      const low = headCells(out, '►', 'row')
      expect(high.length + low.length).toBe(n - 1)
      expect(new Set(high).size).toBe(high.length)
      expect(new Set(low).size).toBe(low.length)
      expect(heads(out)).toBe(n + 2) // + Start -> S and S -> U
    },
  )

  it.each([5, 6, 7])(
    'LR: %i siblings each enter T on a column of their own',
    (n) => {
      const out = render(cluster('LR', n))
      expect(violations(out)).toEqual([])
      const bottom = headCells(out, '▲', 'col')
      const top = headCells(out, '▼', 'col')
      expect(new Set(bottom).size).toBe(bottom.length)
      expect(new Set(top).size).toBe(top.length)
      expect(heads(out)).toBe(n + 2)
    },
  )

  it('labels stay on their own strokes in source order', () => {
    const lines = render(cluster('TD', 7)).split('\n')
    const row = lines.find((l) => l.includes('7') && l.includes('6'))!
    // Siblings stack outward on the low side: the farther the track, the later.
    expect(row.indexOf('7')).toBeLessThan(row.indexOf('6'))
    expect(row.indexOf('6')).toBeLessThan(row.indexOf('5'))
  })

  it('the engaged plan keeps every lane sibling, three to a face', () => {
    const plan = (n: number) => {
      const graph = convertToAsciiGraph(parseMermaid(cluster('TD', n)), {
        useAscii: false,
        paddingX: 6,
        paddingY: 5,
        boxBorderPadding: 1,
        graphDirection: 'TD',
      })
      createMapping(graph)
      const lanes = [...(graph.clusterExitPlans?.values() ?? [])].flatMap((p) =>
        [...p.edges].filter((e) => e.parallelLane),
      )
      return { graph, lanes }
    }
    const { graph, lanes } = plan(7)
    expect(lanes).toHaveLength(7)
    // Three siblings on each side face (rows -1, 0, +1), the first drops in.
    const shifts = lanes.map((e) => clusterLaneEndShift(graph, e))
    expect(shifts.sort()).toEqual([-1, -1, 0, 0, 0, 1, 1].sort())
    // An eighth edge gets a longer target face and still engages.
    expect(plan(8).lanes).toHaveLength(8)
  })

  it('a track that would land on the gutter column is refused', () => {
    const graph = convertToAsciiGraph(parseMermaid(cluster('TD', 6)), {
      useAscii: false,
      paddingX: 6,
      paddingY: 5,
      boxBorderPadding: 1,
      graphDirection: 'TD',
    })
    createMapping(graph)
    const plan = [...graph.clusterExitPlans!.values()][0]!
    const second = [...plan.edges].find((e) => e.parallelLane?.index === 2)!
    expect(clusterLaneSideRoute(graph, plan, second)).not.toBeNull()
    // The second sibling's own track is the target's origin + 4.
    plan.gutter.x = second.to.gridCoord!.x + 4
    expect(clusterLaneSideRoute(graph, plan, second)).toBeNull()
  })
})
