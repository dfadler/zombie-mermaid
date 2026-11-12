/**
 * #2678 — mermaid@12.3.0 draws a cluster title at the top of its box in every
 * direction, BT included (checked headless: label top == box top for TD, BT,
 * LR, RL, nested clusters and `direction` overrides). The ASCII renderer lays
 * BT out as TD and flips the canvas, which carried the title to the bottom.
 * The title band is now laid out on the side the flip turns into the top.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidSVG } from '../../../../src/index.ts'

const rows = (s: string): string[] => s.split('\n')
const rowOf = (s: string, text: string): number =>
  rows(s).findIndex((l) => l.includes(text))
describe('ASCII BT cluster titles sit at the top (#2678)', () => {
  it('root BT: the title is the first row inside the frame', () => {
    const out = renderMermaidASCII(
      'graph BT\n  subgraph Box\n    A --> B\n  end',
    )
    const title = rowOf(out, 'Box')
    expect(title).toBe(1)
    expect(rows(out)[0]).toMatch(/^┌─+┐$/)
    expect(title).toBeLessThan(rowOf(out, ' B '))
  })

  it('nested clusters: both titles at the top of their own frames', () => {
    const out = renderMermaidASCII(
      'graph BT\n  subgraph Outer\n    subgraph Inner\n      A --> B\n    end\n    B --> C\n  end\n  C --> D',
    )
    expect(rowOf(out, 'Outer')).toBeLessThan(rowOf(out, 'Inner'))
    expect(rowOf(out, 'Inner')).toBeLessThan(rowOf(out, ' B '))
    expect(rowOf(out, 'Outer')).toBeLessThan(rowOf(out, ' C '))
  })

  it('multi-line title keeps reading order at the top', () => {
    const out = renderMermaidASCII(
      'graph BT\n  subgraph S["Line one<br/>Line two"]\n    A --> B\n  end',
    )
    expect(rowOf(out, 'Line one')).toBe(1)
    expect(rowOf(out, 'Line two')).toBe(2)
  })

  it('a TD override inside BT, and a BT override inside TD, keep titles on top', () => {
    const td = renderMermaidASCII(
      'graph TD\n  subgraph S[Pipe]\n    direction BT\n    A --> B\n  end',
    )
    expect(rowOf(td, 'Pipe')).toBe(1)
    const bt = renderMermaidASCII(
      'graph BT\n  subgraph S[Pipe]\n    direction TB\n    A --> B\n  end',
    )
    expect(rowOf(bt, 'Pipe')).toBe(1)
  })

  it('an edge leaving the frame has room below the band, and TD/LR/RL are unchanged', () => {
    const src = (d: string) =>
      `graph ${d}\n  subgraph S[Box]\n    A --> B\n  end\n  B --> C`
    const bt = renderMermaidASCII(src('BT'))
    expect(rowOf(bt, 'Box')).toBeLessThan(rowOf(bt, ' A '))
    for (const d of ['TD', 'LR', 'RL']) {
      const out = renderMermaidASCII(src(d))
      expect(rowOf(out, 'Box')).toBeLessThan(rowOf(out, ' A '))
    }
  })
})

describe('SVG BT cluster title already matches (#2678)', () => {
  it('draws the title near the top of the cluster rect', () => {
    const svg = renderMermaidSVG(
      'graph BT\n subgraph Outer\n A --> B\n end\n C --> A',
    )
    const rect = /<rect x="\d+" y="(\d+)" width="\d+" height="(\d+)"/.exec(svg)!
    const title = /<text[^>]* y="(\d+)"[^>]*>Outer/.exec(svg)!
    const top = Number(rect[1])
    expect(Number(title[1]) - top).toBeLessThan(Number(rect[2]) / 2)
  })
})
