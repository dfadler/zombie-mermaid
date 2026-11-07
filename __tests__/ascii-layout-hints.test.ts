import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ElkNotRegisteredError,
  layoutFlowchartSync,
} from '@zombie-mermaid/svg-renderer'
import {
  getAsciiLayout,
  registerAsciiLayout,
  renderMermaidASCII,
} from '@zombie-mermaid/ascii-renderer'
import { parseMermaid, parseErDiagram } from '@zombie-mermaid/mermaid-parser'
import { splitStatements } from '@zombie-mermaid/core'
import {
  asciiLayoutProvider,
  buildHints,
  registerAsciiLayoutFromElk,
} from '../src/ascii-layout-provider.ts'

vi.mock('@zombie-mermaid/svg-renderer', async (orig) => {
  const mod = await orig<typeof import('@zombie-mermaid/svg-renderer')>()
  return { ...mod, layoutFlowchartSync: vi.fn(mod.layoutFlowchartSync) }
})

afterEach(() => registerAsciiLayout(undefined))

const box = (id: string, cx: number, cy: number) => ({
  id,
  cx,
  cy,
  w: 40,
  h: 20,
})

describe('registerAsciiLayout', () => {
  it('registers, reads back and clears a provider', () => {
    expect(getAsciiLayout()).toBeUndefined()
    registerAsciiLayoutFromElk()
    expect(getAsciiLayout()).toBe(asciiLayoutProvider)
    registerAsciiLayout(undefined)
    expect(getAsciiLayout()).toBeUndefined()
  })

  it('leaves a chain, where the grid already agrees with ELK, unchanged', () => {
    const src = 'graph TD\n  A --> B --> C'
    const without = renderMermaidASCII(src)
    registerAsciiLayoutFromElk()
    expect(renderMermaidASCII(src)).toBe(without)
  })
})

describe('buildHints', () => {
  it('keeps a taller node in the layer whose top edge it shares (#2780)', () => {
    // ELK aligns tops: an 80-high node's centre sits 30 below a 20-high one's,
    // which a centre-only tolerance split into two layers.
    const h = buildHints(
      [
        { id: 'a', cx: 20, cy: 10, w: 40, h: 20 },
        { id: 'tall', cx: 100, cy: 40, w: 40, h: 80 },
        { id: 'c', cx: 100, cy: 300, w: 40, h: 20 },
      ],
      [],
      'TD',
    )
    expect(h.nodes.get('a')!.layer).toBe(0)
    expect(h.nodes.get('tall')!.layer).toBe(0)
    expect(h.nodes.get('c')!.layer).toBe(1)
  })

  const paths = [
    {
      from: 'A',
      to: 'B',
      points: [
        { x: 10, y: 10 },
        { x: 10, y: 90 },
      ],
    },
    {
      from: 'A',
      to: 'C',
      points: [
        { x: 30, y: 10 },
        { x: 90, y: 90 },
      ],
    },
    {
      from: 'A',
      to: 'Z',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    }, // Unknown node
    { from: 'A', to: 'B', points: [{ x: 0, y: 0 }] }, // No path
  ]
  const boxes = [box('A', 20, 0), box('B', 20, 100), box('C', 100, 105)]

  it('numbers layers from the source side, ranks by cross axis, and orders ends along a face', () => {
    const h = buildHints(boxes, paths, 'TD')
    expect(h.nodes.get('A')).toMatchObject({ layer: 0, order: 0 })
    // B and C are 5 px apart on the flow axis: one layer; B is left of C.
    expect(h.nodes.get('B')).toMatchObject({ layer: 1, order: 0 })
    expect(h.nodes.get('C')).toMatchObject({ layer: 1, order: 1 })
    expect(h.edges).toHaveLength(2)
    expect(h.edges[0]).toMatchObject({
      index: 0,
      start: { face: 'B', order: 0 },
      end: { face: 'T', order: 0 },
    })
    expect(h.edges[1]!.start).toMatchObject({ face: 'B', order: 1 })
  })

  it('counts layers from the right/bottom for RL and BT, and uses left/right faces for LR', () => {
    expect(buildHints(boxes, [], 'BT').nodes.get('A')!.layer).toBe(1)
    const lr = buildHints(
      [box('A', 0, 0), box('B', 100, 0)],
      [
        {
          from: 'A',
          to: 'B',
          points: [
            { x: 20, y: 0 },
            { x: 80, y: 0 },
          ],
        },
      ],
      'LR',
    )
    expect(lr.edges[0]).toMatchObject({
      start: { face: 'R' },
      end: { face: 'L' },
    })
    expect(lr.nodes.get('B')!.layer).toBe(1)
    expect(
      buildHints([box('A', 0, 0), box('B', 100, 0)], [], 'RL').nodes.get('A')!
        .layer,
    ).toBe(1)
  })
})

describe('asciiLayoutProvider', () => {
  it('gives flowchart hints from the ELK layout', () => {
    const h = asciiLayoutProvider.graph!(
      parseMermaid('graph TD\n  A --> B\n  A --> C'),
    )!
    expect(h.nodes.get('A')!.layer).toBe(0)
    expect(h.nodes.get('B')!.layer).toBe(1)
    expect(h.nodes.get('B')!.order).toBeLessThan(h.nodes.get('C')!.order)
    expect(h.edges[0]!.start.face).toBe('B')
  })

  it('gives ER hints, honouring a declared direction', () => {
    const er = (t: string) => parseErDiagram(splitStatements(t))
    const h = asciiLayoutProvider.er!(
      er('erDiagram\n  A ||--o{ B : has\n  A ||--o{ C : has'),
    )!
    expect(h.nodes.get('A')!.layer).toBe(0)
    expect(h.edges).toHaveLength(2)
    const dir = er('erDiagram\n  direction LR\n  A ||--o{ B : has')
    expect(asciiLayoutProvider.er!(dir)!.edges[0]!.start.face).toBe('R')
  })

  it('returns undefined without elkjs and rethrows other errors', () => {
    const f = vi.mocked(layoutFlowchartSync)
    const g = parseMermaid('graph TD\n  A --> B')
    f.mockImplementationOnce(() => {
      throw new ElkNotRegisteredError()
    })
    expect(asciiLayoutProvider.graph!(g)).toBeUndefined()
    f.mockImplementationOnce(() => {
      throw new Error('boom')
    })
    expect(() => asciiLayoutProvider.graph!(g)).toThrow('boom')
  })
})

describe('ELK hints with a decision among shorter nodes (#2780)', () => {
  it.each(['TD', 'BT', 'LR', 'RL'])(
    "%s: isolated nodes share the decision's rank, duplicated edge renders",
    (dir) => {
      registerAsciiLayoutFromElk()
      const src = `flowchart ${dir}\n  n0(["n54J9wn"])\n  n1(["m"])\n  n2{"1z"}\n  n3(["5Ux716"])\n  n4("E8Hl7O")\n  n2 --> n0\n  n2 --> n0\n  n2 --> n3\n`
      const lines = renderMermaidASCII(src, {
        colorMode: 'none',
        useAscii: false,
      }).split('\n')
      const row = (s: string) => lines.findIndex((l) => l.includes(s))
      const col = (s: string) => lines.find((l) => l.includes(s))!.indexOf(s)
      if (dir === 'LR' || dir === 'RL') {
        // Same column as the decision (centres within a box's slack).
        expect(Math.abs(col('m') - col('1z'))).toBeLessThanOrEqual(5)
        expect(Math.abs(col('E8Hl7O') - col('1z'))).toBeLessThanOrEqual(8)
      } else {
        expect(row('m')).toBe(row('1z'))
        expect(row('E8Hl7O')).toBe(row('1z'))
      }
    },
  )
})
