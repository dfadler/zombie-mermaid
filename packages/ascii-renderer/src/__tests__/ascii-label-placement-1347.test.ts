/**
 * #1347: a label must stay readable and on its own edge. Labels are chosen
 * once every path is routed, so one never lands on a segment another edge also
 * runs along or on a segment another label holds, and an edge arriving at a
 * node's side port is drawn on its own row, apart from an edge leaving it.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const DENSE = `graph TD
A -->|x| B
B -->|long label| A
A -->|long label| C
C -->|ab| A
B -->|mid| D
A -->|ab| D
D -->|x| A`

const render = (src: string): string =>
  renderMermaidASCII(src, { colorMode: 'none' })

describe('ASCII label placement (#1347)', () => {
  it('draws every label of the dense reciprocal diagram', () => {
    const out = render(DENSE)
    // Two edges carry `x` and two carry `ab`; a label drawn over another
    // would leave fewer of them. (`long label` may be drawn as `long─label`
    // on a stroke until #1348, so count the word.)
    expect(out.match(/\bx\b/g)).toHaveLength(2)
    expect(out.match(/\bab\b/g)).toHaveLength(2)
    expect(out.match(/\bmid\b/g)).toHaveLength(1)
    expect(out.match(/long/g)).toHaveLength(2)
  })

  it('keeps two labels that share a merged tail apart', () => {
    // `Y --> A` merges into `X --> A`'s route; both labels must survive.
    const out = render(`graph TD
A --> B
B --> X
X -->|first| A
B --> Y
Y -->|second| A`)
    expect(out).toContain('first')
    expect(out).toContain('second')
  })

  it('draws an arrival and a departure at one side port on separate rows', () => {
    // A's box is the first five rows. On its right border the arrow back into
    // A (`◄`) and the stroke leaving for C (`├─`) sit on different rows.
    const box = render(DENSE).split('\n').slice(0, 5)
    const arrive = box.findIndex((r) => r.includes('◄'))
    const leave = box.findIndex((r) => /├─/.test(r))
    expect(arrive).toBeGreaterThanOrEqual(0)
    expect(leave).toBeGreaterThanOrEqual(0)
    expect(arrive).not.toBe(leave)
  })

  it('does not inflate a node to make room for a label beside its stroke', () => {
    const rows = render(DENSE).split('\n')
    const row = rows.find((r) => /│\s+C\s+[│├┤]/.test(r))!
    // C's box stays the 5-wide one it is without the label.
    expect(/│\s+C\s+[│├┤]/.exec(row)![0].length).toBeLessThanOrEqual(7)
  })
})
