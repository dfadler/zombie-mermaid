import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../index.ts'

const render = (src: string): string[] =>
  renderMermaidASCII(src, { colorMode: 'none' })
    .split('\n')
    .map((l) => l.trimEnd())

// Mermaid (12.3.0) leaves every edge of a fan-out by the source's bottom face,
// bends just below it and drops into each target's top face, with the label
// on the drop. Part of dfadler/zombie-mermaid#2619 (ascii-flow-axis-faces).
describe('flow-face fan-out (TD)', () => {
  it('leaves the bottom face for every target, a stem per line style', () => {
    const rows = render(`graph TD
  A[Source] -->|solid| B[Target 1]
  A -.->|dotted| C[Target 2]
  A ==>|thick| D[Target 3]`)
    const sourceRow = rows.find((l) => l.includes('Source'))!
    expect(sourceRow).not.toMatch(/[├┤]/)
    expect(
      rows.find((l) => l.includes('└') && l.includes('┬'))!.match(/┬/g),
    ).toHaveLength(3)
    // Each stem keeps its own glyphs: the dotted one is never heavy.
    const bar = rows.find((l) => l.includes('┐') && l.includes('━'))!
    expect(bar.slice(bar.indexOf('━'), bar.lastIndexOf('┐') + 1)).not.toMatch(
      /[┄┆]/,
    )
  })

  it('puts each label on its own drop, between the bend and the arrowhead', () => {
    const rows = render(`graph TD
  A -->|x| B
  A -->|yy| C
  A -->|zzz| D`)
    for (const label of ['x', 'yy', 'zzz']) {
      const row = rows.findIndex((l) => new RegExp(`\\b${label}\\b`).test(l))
      const mid = rows[row]!.indexOf(label) + Math.floor(label.length / 2)
      expect(rows[row - 1]![mid]).toBe('│')
      expect(rows[row + 1]![mid]).toBe('│')
    }
  })

  it('splits a mixed-style left and right bend with no straight stem', () => {
    const rows = render(`graph TD
  A -->|a| B
  A -.->|b| C`)
    const border = rows.find((l) => l.includes('└') && l.includes('┬'))!
    expect(border.match(/┬/g)).toHaveLength(2)
    expect(rows.join('\n')).toContain('┆')
  })

  it('keeps a reciprocal pair, a subgraph member and LR on their own routing', () => {
    const pair = render(`graph TD
  A --> B
  B --> A
  A --> C`)
    expect(pair.join('\n')).toContain('A')
    const sub = render(`graph TD
  subgraph S
    A --> B
    A --> C
  end`)
    expect(sub.join('\n')).toContain('B')
    const lr = render(`graph LR
  A -->|x| B
  A -->|y| C`)
    expect(lr.find((l) => l.includes('A'))).toMatch(/A/)
  })
})

// LR mirror: out of the right face, a stem each, label on its own run.
describe('flow-face fan-out (LR)', () => {
  it('leaves the right face for every target, labels on their own runs', () => {
    const out = render(`flowchart LR
  S0 --> |e0| S1
  S1 --> |e1| S2
  S1 --> S3
  S0 --> S4`).join('\n')
    expect(out).toMatch(/│ S0 ├─/)
    expect(out).toMatch(/┌─e0─►│ S1/)
    expect(out).toMatch(/└─+►│ S4/)
    expect(out).toMatch(/└────┘ +│/)
  })

  it('keeps mixed line styles from sharing a glyph', () => {
    const out = render(`graph LR
  C --> B
  B --> E
  B -.-> F
  B ==> G`).join('\n')
    expect(out).toMatch(/┄►/)
    expect(out).toMatch(/━►/)
  })

  it('leaves a source with a self-loop or a reciprocal edge alone', () => {
    const out = render(`graph LR
  A --> A
  A --> B
  A --> C`).join('\n')
    expect(out).toContain('B')
    const pair = render(`graph LR
  A --> B
  B --> A
  A --> C`).join('\n')
    expect(pair).toContain('C')
  })
})
