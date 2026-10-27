/**
 * An LR/RL fan-out parent is centred over its children, as in TD and as
 * mermaid 12.1.0 / 12.2.0 draw it (#2163), instead of sitting on the first
 * child's row with the rest stacked below it.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (src: string, useAscii = false): string[] =>
  renderMermaidASCII(src, { colorMode: 'none', useAscii })
    .split('\n')
    .map((l) => l.trimEnd())

/** Row index of the middle line of the box labelled `label`. */
const rowOf = (lines: string[], label: string): number => {
  const i = lines.findIndex((l) => l.includes(` ${label} `))
  if (i < 0) throw new Error(`no row contains ${label}`)
  return i
}

describe('centering a fan-out parent in LR/RL (#2163)', () => {
  it.each([2, 3, 5])('centres over %i children', (n) => {
    const kids = Array.from({ length: n }, (_, i) => `K${i}`)
    const out = render(
      `graph LR\n${kids.map((k) => `  P --> ${k}`).join('\n')}`,
    )
    const rows = kids.map((k) => rowOf(out, k))
    const mid = (Math.min(...rows) + Math.max(...rows)) / 2
    // Even counts straddle the gap between the two middle children.
    expect(Math.abs(rowOf(out, 'P') - mid)).toBeLessThanOrEqual(2)
    expect(rowOf(out, 'P')).toBeGreaterThan(rows[0]!)
    expect(rowOf(out, 'P')).toBeLessThan(rows[n - 1]!)
  })

  it('renders the issue repro with Done above and Café below the decision', () => {
    const out = render(`graph LR
  A[Start] -->|go| B{Ok?}
  B -->|yes| C((Done))
  B -->|no| D[Café 日本語]`)
    const row = (s: string): number => out.findIndex((l) => l.includes(s))
    expect(row('Done')).toBeLessThan(row('Ok?'))
    expect(row('Ok?')).toBeLessThan(row('Café'))
    expect(row('Start')).toBe(row('Ok?'))
  })

  it.each([false, true])('centres in RL (useAscii: %s)', (useAscii) => {
    const out = render(`graph RL\n  P --> A\n  P --> B\n  P --> C`, useAscii)
    const row = (l: string): number =>
      out.findIndex((x) => x.includes(` ${l} `))
    expect(row('A')).toBeLessThan(row('P'))
    expect(row('P')).toBe(row('B'))
    expect(row('P')).toBeLessThan(row('C'))
  })

  it('leaves an LR fan-out inside a subgraph where it was', () => {
    const out = render(`graph LR
  subgraph s
  P --> A
  P --> B
  end`)
    expect(rowOf(out, 'P')).toBe(rowOf(out, 'A'))
  })
})
