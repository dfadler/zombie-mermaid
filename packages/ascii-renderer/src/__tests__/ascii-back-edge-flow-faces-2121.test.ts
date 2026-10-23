/**
 * #2121: a back-edge between nodes in one column (row, in LR) is drawn on the
 * flow-axis faces like mermaid does (pinned mermaid 12.1.0: `c --> a` leaves
 * c's top, runs up a lane beside the column, enters a's bottom), with its
 * ports at the outer end of each face so it never crosses a forward stem.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { convertToAsciiGraph } from '../converter.ts'
import { createMapping } from '../grid.ts'
import { portShifts } from '../port-offsets.ts'

const CYCLE = (dir: string): string =>
  `flowchart ${dir}\n a --> b\n b --> c\n c --> a`

function layout(source: string, dir: 'TD' | 'LR') {
  const graph = convertToAsciiGraph(parseMermaid(source), {
    useAscii: false,
    paddingX: 5,
    paddingY: 5,
    boxBorderPadding: 1,
    graphDirection: dir,
  })
  createMapping(graph)
  return graph
}

function backEdge(dir: 'TD' | 'LR') {
  return layout(CYCLE(dir), dir).edges.find(
    (e) => e.from.name === 'c' && e.to.name === 'a',
  )!
}

describe('ASCII back-edge on the flow-axis faces (#2121)', () => {
  it('TD: leaves c up, runs right of the column, enters a from below', () => {
    const e = backEdge('TD')
    expect(e.faceLane).toBe(true)
    // Up, right, up, left, up: the path c.top -> gutter -> lane -> gutter -> a.bottom
    expect(e.path).toEqual([
      { x: 1, y: 8 },
      { x: 1, y: 7 },
      { x: 3, y: 7 },
      { x: 3, y: 3 },
      { x: 1, y: 3 },
      { x: 1, y: 2 },
    ])
  })

  it('TD: forward stems stay centred and the back-edge ports sit right of them', () => {
    const rows = renderMermaidASCII(CYCLE('TD'), { colorMode: 'none' }).split(
      '\n',
    )
    // A's bottom border: forward stem at the centre, back-edge arrowhead two
    // cells right; no stem or head on the left half.
    const border = rows.findIndex((r) => r.startsWith('└──┬──┘'))
    expect(border).toBeGreaterThan(0)
    expect(rows[border + 1]!.trimEnd()).toBe('   │ ▲')
    // C's top border: the back-edge leaves two cells right of the stem.
    const top = rows.findIndex((r, i) => i > border && r.startsWith('┌────┴┐'))
    expect(top).toBeGreaterThan(border)
  })

  it('LR: leaves c left, runs below the row, enters a from the right', () => {
    const e = backEdge('LR')
    expect(e.faceLane).toBe(true)
    expect(e.path[0]).toEqual({ x: 8, y: 1 })
    expect(e.path[e.path.length - 1]).toEqual({ x: 2, y: 1 })
    expect(Math.max(...e.path.map((p) => p.y))).toBe(3)
    const out = renderMermaidASCII(CYCLE('LR'), { colorMode: 'none' })
    expect(out).toContain('◄─┐')
    expect(out).toContain('┌──┤')
  })

  it('BT and RL mirror TD and LR', () => {
    const bt = renderMermaidASCII(CYCLE('BT'), { colorMode: 'none' })
    expect(bt).toContain('▼')
    const rl = renderMermaidASCII(CYCLE('RL'), { colorMode: 'none' })
    expect(rl).toContain('┌─►')
  })

  it('leaves a reciprocal pair as two strokes between the faces', () => {
    const g = convertToAsciiGraph(
      parseMermaid('flowchart TD\n a --> b\n b --> a'),
      {
        useAscii: false,
        paddingX: 5,
        paddingY: 5,
        boxBorderPadding: 1,
        graphDirection: 'TD',
      },
    )
    createMapping(g)
    expect(g.edges.some((e) => e.faceLane)).toBe(false)
  })

  describe('forward skips and parallel back-edges share the gutter', () => {
    const SKIPS = (dir: string): string =>
      `flowchart ${dir}\n a --> b\n b --> c\n a --> c\n c --> a\n c --> a`

    it.each(['TD', 'LR'] as const)(
      '%s: forward lane inside the back-edge lanes, each on its own slot',
      (dir) => {
        const g = layout(SKIPS(dir), dir)
        const lanes = g.edges.filter((e) => e.faceLane)
        expect(lanes).toHaveLength(3)
        // The lane runs at the third path point's cross coordinate.
        const cross = (e: (typeof lanes)[number]) =>
          dir === 'TD' ? e.path[2]!.x : e.path[2]!.y
        const forward = lanes.find((e) => e.from.name === 'a')!
        const back = lanes.filter((e) => e.from.name === 'c')
        expect(cross(forward)).toBeLessThan(Math.min(...back.map(cross)))
        expect(new Set(lanes.map(cross)).size).toBe(3)
      },
    )

    it.each(['TD', 'LR'] as const)(
      '%s: horizontal runs sharing a gutter row are drawn on rows of their own',
      (dir) => {
        const g = layout(SKIPS(dir), dir)
        const shifts = portShifts(g)
        // A's far gutter holds the forward departure (points 1-2) and both
        // back-edge arrivals (points 3-4), so their offsets differ.
        const at = (e: (typeof g.edges)[number], i: number) => {
          const p = shifts.get(e)!.points![i]!
          return dir === 'TD' ? p.y : p.x
        }
        const fwd = g.edges.find((e) => e.faceLane && e.from.name === 'a')!
        const backs = g.edges.filter((e) => e.faceLane && e.from.name === 'c')
        const nearA = [at(fwd, 1), ...backs.map((e) => at(e, 3))]
        expect(new Set(nearA).size).toBe(3)
      },
    )

    it('plans the skips and back-edges beside duplicates between neighbours', () => {
      const g = layout(
        'flowchart TD\n a --> b\n a --> b\n b --> c\n a --> c\n c --> a',
        'TD',
      )
      expect(g.edges.filter((e) => e.faceLane)).toHaveLength(2)
      // The neighbour duplicates are two strokes on the facing faces, not lanes.
      const dups = g.edges.filter(
        (e) => e.from.name === 'a' && e.to.name === 'b',
      )
      expect(dups.every((e) => e.parallelLane === undefined)).toBe(true)
      expect(dups.every((e) => e.path.length === 2)).toBe(true)
    })
  })
})
