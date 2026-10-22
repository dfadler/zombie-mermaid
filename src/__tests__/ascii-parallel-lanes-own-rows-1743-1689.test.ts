/**
 * #1743 / #1689: every lane of a parallel-edge group (any number: the box grows
 * past a three-cell face, #1826) enters the target with an arrowhead of its own,
 * instead of merging into one with `┴`/`┼` junctions.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const labels = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
]

const lanes = (dir: 'TD' | 'LR', count: number): string =>
  [
    `flowchart ${dir}`,
    ...labels.slice(0, count).map((label) => `  A -->|${label}| B`),
  ].join('\n')

const cluster = (count: number): string =>
  [
    'flowchart TD',
    '  subgraph S [Cluster]',
    '    a',
    '  end',
    '  Start --> S',
    ...labels.slice(0, count).map((_, i) => `  S -->|${i + 1}| T`),
    '  S -->|other| U',
  ].join('\n')

const draw = (source: string, useAscii = false): string =>
  renderMermaidASCII(source, { colorMode: 'none', useAscii })

const count = (text: string, ch: string): number => text.split(ch).length - 1

describe('plain parallel lanes each get an arrowhead (#1743)', () => {
  it.each([3, 4, 5, 6])('TD, %i lanes', (n) => {
    const out = draw(lanes('TD', n))
    // One straight arrowhead on top, one per side lane on the right face
    expect(count(out, '◄')).toBe(n - 1)
    expect(out).not.toMatch(/◄[─]*┴|┼/)
  })

  it('TD, four lanes in the ASCII charset', () => {
    expect(count(draw(lanes('TD', 4), true), '<')).toBe(3)
  })

  it.each([3, 4, 5, 6])('LR, %i lanes', (n) => {
    const out = draw(lanes('LR', n))
    expect(count(out, '▲')).toBe(n - 1)
    expect(out).not.toContain('┼')
  })
})

describe('cluster exit siblings each get an arrowhead (#1689)', () => {
  it.each([4, 5, 6, 7])('%i siblings into one target', (n) => {
    const out = draw(cluster(n))
    // Sibling 1 drops in from the top; the rest enter a side face
    expect(count(out, '◄') + count(out, '►')).toBe(n - 1)
    expect(out).not.toContain('┼')
    for (let i = 1; i <= n; i++) expect(out).toContain(String(i))
  })
})
