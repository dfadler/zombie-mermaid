/**
 * Longest-path layering: a node ranks below every parent that reaches it, as
 * dagre ranks it, rather than beside the first parent that happened to place
 * it. Back edges (cycles) are ignored when ranking.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

function rowOf(ascii: string, label: string): number {
  return ascii
    .split('\n')
    .findIndex((r) => new RegExp(`│\\s+${label}\\s+[│├┤]`).test(r))
}

function colOf(ascii: string, label: string): number {
  for (const r of ascii.split('\n')) {
    const m = new RegExp(`│\\s+${label}\\s+[│├┤]`).exec(r)
    if (m) return m.index
  }
  return -1
}

const render = (src: string): string =>
  renderMermaidASCII(src, { colorMode: 'none' })

describe('ASCII longest-path layering', () => {
  it('ranks D below B when both A --> D and B --> D exist (TD)', () => {
    const out = render('graph TD\nA --> B\nA --> D\nB --> D')
    expect(rowOf(out, 'D')).toBeGreaterThan(rowOf(out, 'B'))
    expect(rowOf(out, 'B')).toBeGreaterThan(rowOf(out, 'A'))
  })

  it('ranks C after B in LR when A --> C and B --> C exist', () => {
    const out = render('graph LR\nA --> B\nB --> C\nA --> C')
    expect(colOf(out, 'C')).toBeGreaterThan(colOf(out, 'B'))
    expect(colOf(out, 'B')).toBeGreaterThan(colOf(out, 'A'))
  })

  it('ignores back edges: reciprocal pairs keep the forward order', () => {
    const out = render(
      'graph TD\nA -->|x| B\nB -->|y| A\nA --> C\nC --> A\nB --> D\nA --> D\nD --> A',
    )
    const a = rowOf(out, 'A')
    expect(rowOf(out, 'B')).toBeGreaterThan(a)
    expect(rowOf(out, 'C')).toBe(rowOf(out, 'B'))
    expect(rowOf(out, 'D')).toBeGreaterThan(rowOf(out, 'B'))
  })

  it('still lays out a pure cycle without losing a node', () => {
    const out = render('graph TD\nA --> B\nB --> C\nC --> A')
    for (const n of ['A', 'B', 'C'])
      expect(rowOf(out, n)).toBeGreaterThanOrEqual(0)
  })
})
