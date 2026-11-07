/**
 * #2645 PR 3: flowchart and state placement takes layer, in-layer order and
 * cross-axis centre from the registered layout provider. A fake provider keeps
 * these independent of ELK; the ELK-backed end-to-end cases are in
 * __tests__/ascii-layout-hints.test.ts and the topology gate.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  registerAsciiLayout,
  renderMermaidASCII,
  type AsciiLayoutHints,
  type AsciiNodeHint,
} from '@zombie-mermaid/ascii-renderer'

afterEach(() => registerAsciiLayout(undefined))

const hint = (
  layer: number,
  order: number,
  cross: number,
  size = 40,
): AsciiNodeHint => ({ layer, order, cross, size })
const provide = (nodes: Record<string, AsciiNodeHint>) =>
  registerAsciiLayout({
    graph: () =>
      ({
        nodes: new Map(Object.entries(nodes)),
        edges: [],
      }) as AsciiLayoutHints,
  })
/** Row and column of the box labelled `text` (the first row holding its label). */
const at = (art: string, text: string) => {
  const rows = art.split('\n')
  const find = (r: string) =>
    r.split(/\s+/).indexOf(text) >= 0 && r.includes('│')
  const row = rows.findIndex(find)
  const r = rows[row]!
  return { row, col: r.indexOf(text) }
}

describe('layout hints drive flowchart placement', () => {
  const src = 'graph TD\n  A --> B\n  A --> C'

  it('takes in-layer order from the hints, not from declaration order', () => {
    const grid = renderMermaidASCII(src)
    expect(at(grid, 'B').col).toBeLessThan(at(grid, 'C').col)
    provide({
      A: hint(0, 0, 40),
      B: hint(1, 1, 80),
      C: hint(1, 0, 0),
    })
    const art = renderMermaidASCII(src)
    expect(at(art, 'C').col).toBeLessThan(at(art, 'B').col)
  })

  it('takes the layer from the hints: a node can sit one layer further out', () => {
    provide({ A: hint(0, 0, 0), B: hint(1, 0, 0), C: hint(2, 0, 0) })
    const art = renderMermaidASCII(src)
    expect(at(art, 'B').row).toBeLessThan(at(art, 'C').row)
    expect(at(art, 'B').col).toBe(at(art, 'C').col)
  })

  it('offsets a layer by the cross-axis centres (a staircase, not one row)', () => {
    provide({ A: hint(0, 0, 0), B: hint(1, 0, 0), C: hint(2, 0, 80) })
    const art = renderMermaidASCII('graph TD\n  A --> B --> C')
    expect(at(art, 'C').col).toBeGreaterThan(at(art, 'B').col)
  })

  it('keeps two nodes of one layer apart even when their centres coincide', () => {
    provide({ A: hint(0, 0, 0), B: hint(1, 1, 0), C: hint(1, 0, 0) })
    const art = renderMermaidASCII(src)
    // The tie is broken by hint order (C first), not declaration order.
    expect(at(art, 'B').col).toBeGreaterThan(at(art, 'C').col + 4)
  })

  it('lays out LR with layers along x and the cross axis down', () => {
    provide({ A: hint(0, 0, 40), B: hint(1, 0, 0), C: hint(1, 1, 80) })
    const art = renderMermaidASCII('graph LR\n  A --> B\n  A --> C')
    expect(at(art, 'B').col).toBeGreaterThan(at(art, 'A').col)
    expect(at(art, 'B').col).toBe(at(art, 'C').col)
    expect(at(art, 'B').row).toBeLessThan(at(art, 'C').row)
  })

  it('falls back to the grid when a node has no hint', () => {
    const grid = renderMermaidASCII(src)
    provide({ A: hint(0, 0, 0), B: hint(1, 1, 0) })
    expect(renderMermaidASCII(src)).toBe(grid)
  })

  it('falls back to the grid when the provider has no graph method or returns nothing', () => {
    const grid = renderMermaidASCII(src)
    registerAsciiLayout({})
    expect(renderMermaidASCII(src)).toBe(grid)
    registerAsciiLayout({ graph: () => undefined })
    expect(renderMermaidASCII(src)).toBe(grid)
  })

  it('falls back to the grid when a subgraph sets its own direction', () => {
    const sub = 'graph TD\n  subgraph S\n    direction LR\n    X --> Y\n  end'
    const grid = renderMermaidASCII(sub)
    provide({ X: hint(0, 0, 0), Y: hint(0, 1, 90), S: hint(0, 0, 0) })
    expect(renderMermaidASCII(sub)).toBe(grid)
  })

  it('leaves the class diagram on the grid', () => {
    const cls = 'classDiagram\n  direction LR\n  A <|-- B\n  A <|-- C'
    const grid = renderMermaidASCII(cls)
    provide({ A: hint(2, 0, 0), B: hint(0, 0, 0), C: hint(1, 0, 0) })
    expect(renderMermaidASCII(cls)).toBe(grid)
  })

  it('asks the provider once per parsed graph, however many layout passes run', () => {
    const graph = vi.fn(
      () =>
        ({
          nodes: new Map([
            ['A', hint(0, 0, 0)],
            ['B', hint(1, 0, 0)],
          ]),
          edges: [],
        }) as AsciiLayoutHints,
    )
    registerAsciiLayout({ graph })
    // A self-loop on a top face reruns createMapping with a margin row.
    renderMermaidASCII('graph TD\n  A --> B\n  A --> A')
    expect(graph).toHaveBeenCalledTimes(1)
  })
})
