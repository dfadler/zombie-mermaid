/**
 * #2100 (LR): a skip edge beside a reciprocal pair on one of its ends runs
 * under the row from its own bottom faces (own arrowhead, own port), the pair
 * is two strokes between the facing side faces (as mermaid 12.2.0 draws it),
 * and a self-loop on the pair's node sits above it, in a margin row.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const SAMPLE = (dir: string): string =>
  `flowchart ${dir}\n a["a"]\n b["b"]\n c["c"]\n a --> a\n b --> a\n a --> c\n b --> c\n c --> a`

const render = (src: string): string =>
  renderMermaidASCII(src, { colorMode: 'none' })
    .split('\n')
    .map((r) => r.trimEnd())
    .join('\n')
    .replace(/^\n+|\n+$/g, '')

describe('LR skip edge under a reciprocal pair (#2100)', () => {
  it('draws the issue sample like mermaid: loop on top, pair, skip under', () => {
    expect(render(SAMPLE('LR'))).toBe(
      [
        '            ┌────┐',
        '            ▼    │',
        '┌───┐     ┌───┐  │  ┌───┐',
        '│   │     │   ├──┘  │   │',
        '│ b ├────►│ a │◄────┤ c │',
        '│   │     │   ├────►│   │',
        '└─┬─┘     └───┘     └───┘',
        '  │                   ▲',
        '  └───────────────────┘',
      ].join('\n'),
    )
  })

  it.each([
    ['c --> a first', ['c --> a', 'b --> a', 'a --> c', 'b --> c', 'a --> a']],
    ['loop first', ['a --> a', 'b --> a', 'a --> c', 'b --> c', 'c --> a']],
  ])('draws the same whichever edge is declared first (%s)', (_name, edges) => {
    const src = `flowchart LR\n a["a"]\n b["b"]\n c["c"]\n ${edges.join('\n ')}`
    // The loop leaves the top row of a's right face: nothing crosses it.
    expect(render(src)).toBe(render(SAMPLE('LR')))
    expect(render(src)).not.toMatch(/┼/)
  })

  it('mirrors for RL', () => {
    const text = render(SAMPLE('RL'))
    expect(text).toMatch(/│ c ├────►│ a │◄────┤ b │/)
    expect(text.match(/▲/g)).toHaveLength(1)
  })

  it('keeps the old route when the pair node is busy (4+ edges)', () => {
    // c has four edges: the pair keeps its U under the row, as before.
    expect(
      render('flowchart LR\n b-->a\n a-->c\n b-->c\n c-->a\n c-->d'),
    ).toBe(
      [
        '┌───┐     ┌───┐     ┌───┐     ┌───┐',
        '│   │     │   │     │   │     │   │',
        '│ b ├──┬─►│ a ├──┬─►│ c ├────►│ d │',
        '│   │  │  │   │  │  │   │     │   │',
        '└───┘  │  └───┘  │  └─┬─┘     └───┘',
        '       │    ▲    │    │',
        '       └────┼────┘    │',
        '            │         │',
        '            └─────────┘',
      ].join('\n'),
    )
  })
})
