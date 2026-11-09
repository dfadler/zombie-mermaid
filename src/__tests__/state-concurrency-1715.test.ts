/**
 * #1715: a bare `--` line inside a composite state separates concurrent
 * regions. It used to be merged into the preceding transition as a
 * "continuation line", which dropped the node after the first arrow. Each
 * region is now its own dashed, untitled box (mermaid.js's `divider` cluster).
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid, renderMermaidASCII, renderMermaidSVG } from '../index.ts'
import { layoutGraphSync } from '@zombie-mermaid/svg-renderer'

const SRC = `stateDiagram-v2
    state Work {
        [*] --> A1
        A1 --> A2
        --
        [*] --> B1
        B1 --> B2
    }`

describe('state concurrency regions (#1715)', () => {
  it('keeps every state and edge on both sides of the separator', () => {
    const g = parseMermaid(SRC)
    expect([...g.nodes.keys()].filter((id) => !id.startsWith('_'))).toEqual([
      'A1',
      'A2',
      'B1',
      'B2',
    ])
    expect(g.edges.map((e) => `${e.source}>${e.target}`)).toEqual([
      '_start>A1',
      'A1>A2',
      '_start2>B1',
      'B1>B2',
    ])
  })

  it('splits the composite into one region per section, in written order', () => {
    const [work] = parseMermaid(SRC).subgraphs
    expect(work!.nodeIds).toEqual([])
    expect(work!.children.map((r) => [r.region, r.nodeIds])).toEqual([
      [true, ['_start', 'A1', 'A2']],
      [true, ['_start2', 'B1', 'B2']],
    ])
  })

  it('supports more than two regions', () => {
    const [work] = parseMermaid(`stateDiagram-v2
  state W {
    a --> b
    --
    c --> d
    --
    e --> f
  }`).subgraphs
    expect(work!.children.map((r) => r.nodeIds)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
    ])
  })

  it('does not treat `--` as a region outside a composite, and leaves flowchart continuation lines alone', () => {
    expect(
      parseMermaid('stateDiagram-v2\n  a --> b\n  --\n').subgraphs,
    ).toEqual([])
    const g = parseMermaid('flowchart TD\n  A\n  --> B')
    expect(g.edges.map((e) => `${e.source}>${e.target}`)).toEqual(['A>B'])
  })

  it('ASCII draws every state with dashed region borders', () => {
    const out = renderMermaidASCII(SRC)
    for (const id of ['A1', 'A2', 'B1', 'B2']) expect(out).toContain(id)
    expect(out).toContain('┄')
    expect(out).toContain('┆')
  })

  it('SVG draws every state inside dashed untitled regions', () => {
    const svg = renderMermaidSVG(SRC)
    for (const id of ['A1', 'A2', 'B1', 'B2']) expect(svg).toContain(`>${id}<`)
    expect(svg.match(/class="subgraph subgraph-region"/g)).toHaveLength(2)
    expect(svg.match(/stroke-dasharray="6 4"/g)).toHaveLength(2)
  })

  // mermaid 12.3.0 (#2899): regions in written order, two across, the third
  // wrapped under the first.
  it.each([3, 4, 5])('%i regions wrap two across in written order', (n) => {
    const ids = 'ABCDE'.slice(0, n).split('')
    const src = `stateDiagram-v2
  state W {
${ids.map((i) => `    [*] --> ${i}`).join('\n    --\n')}
  }`
    const g = layoutGraphSync(parseMermaid(src))
    const at = (id: string) => g.nodes.find((x) => x.id === id)!
    ids.forEach((id, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const a = at(ids[col]!)
      expect(at(id).x).toBeCloseTo(a.x, 0)
      expect(at(id).y).toBeCloseTo(at(ids[row * 2]!).y, 0)
      if (col === 1) expect(at(id).x).toBeGreaterThan(at(ids[0]!).x)
      if (row > 0) expect(at(id).y).toBeGreaterThan(at(ids[0]!).y)
    })
  })
})
