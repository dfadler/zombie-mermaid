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

  // Mermaid 12.3.0 (#2899): regions in written order, two across, the third
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

  // Mermaid 12.3.0 (#2962): unequal regions are packed smallest first, ties in
  // written order. Probed positions: C top-left, A top-right, B under C.
  it('packs unequal-height regions smallest first', () => {
    const g = layoutGraphSync(
      parseMermaid(`stateDiagram-v2
  state W {
    A --> A2
    --
    B --> B2
    --
    C
  }`),
    )
    const at = (id: string) => g.nodes.find((x) => x.id === id)!
    expect(at('A').x).toBeGreaterThan(at('C').x)
    expect(at('A').y).toBeCloseTo(at('C').y, 0)
    expect(at('B').x).toBeCloseTo(at('C').x, 0)
    expect(at('B').y).toBeGreaterThan(at('C').y)
  })

  it('declares a bare state id inside a region', () => {
    const g = parseMermaid(
      'stateDiagram-v2\n  state W {\n    A\n    --\n    B\n  }',
    )
    expect([...g.nodes.keys()].sort()).toEqual(['A', 'B'])
  })

  // Mermaid 12.3.0 (#3013): `[*] --> W` and `W --> Z` attach to W's own wall,
  // not to a member inside a region.
  it('ASCII joins the edges into and out of a composite with regions to its frame', () => {
    const out = renderMermaidASCII(`stateDiagram-v2
  [*] --> W
  state W {
    A --> A2
    --
    B --> B2
    --
    C
  }
  W --> Z`)
    const lines = out.split('\n')
    const top = lines.findIndex((l) => l.startsWith('┌'))
    const bottom = lines.findIndex((l) => l.startsWith('└'))
    // The start dot and its line run into W's top wall.
    expect(lines.slice(0, top).join('\n')).toMatch(/●[^▼]*│[^▼]*▼/s)
    // The exit leaves through W's bottom wall, and nothing inside the frame
    // sprouts a side exit through a region wall.
    expect(lines[bottom]).toContain('┬')
    expect(lines.slice(top, bottom).join('')).not.toMatch(/[├┤]/)
    // ...and runs straight down to Z: one column from the wall to the arrowhead
    // (mermaid 12.3.0 draws it vertically at W's centre, over Z).
    const col = lines[bottom]!.indexOf('┬')
    const arrow = lines.findIndex((l, i) => i > bottom && l.includes('▼'))
    expect(arrow).toBeGreaterThan(bottom)
    for (const l of lines.slice(bottom + 1, arrow + 1)) {
      expect(l.trim()).toHaveLength(1)
      expect(l.indexOf(l.trim())).toBe(col)
    }
  })
})
