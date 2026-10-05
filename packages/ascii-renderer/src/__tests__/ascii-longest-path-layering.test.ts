/**
 * Longest-path layering: a node ranks below every parent that reaches it, as
 * dagre ranks it, rather than beside the first parent that happened to place
 * it. Back edges (cycles) are ignored when ranking.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

/** Column where a node box labelled `label` starts on this row, or -1. */
function boxCol(row: string, label: string): number {
  for (const m of row.matchAll(/│\s+(\S+)\s+(?=[│├┤])/g)) {
    if (m[1] === label) return m.index
  }
  return -1
}

function rowOf(ascii: string, label: string): number {
  return ascii.split('\n').findIndex((r) => boxCol(r, label) >= 0)
}

function colOf(ascii: string, label: string): number {
  for (const r of ascii.split('\n')) {
    const c = boxCol(r, label)
    if (c >= 0) return c
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

  // D ranks below E, but C and E fill the column under B; D must move off it
  // or `B --> D` has to wrap around both.
  it('moves a pushed-down child off an unrelated sibling’s column (TD)', () => {
    const out = render('graph TD\nA --> B\nB --> C\nB --> D\nC --> E\nE --> D')
    expect(rowOf(out, 'D')).toBeGreaterThan(rowOf(out, 'E'))
    expect(colOf(out, 'D')).toBeGreaterThan(colOf(out, 'C'))
  })

  it('does the same on the row axis (LR)', () => {
    const out = render('graph LR\nA --> B\nB --> C\nB --> D\nC --> E\nE --> D')
    expect(colOf(out, 'D')).toBeGreaterThan(colOf(out, 'E'))
    expect(rowOf(out, 'D')).toBeGreaterThan(rowOf(out, 'C'))
  })
})
