/**
 * #2043/#2044, then #2739: an LR edge that jumps a node on its row (`A --> C`
 * past `B`) used to share its first segment with `A --> B` and merge with
 * `B --> C` into one arrowhead. Mermaid 12.3.0 steps `B` aside (above, since
 * `A --> B` is declared first) and runs `A --> C` straight along the row, each
 * edge leaving A's right face and entering C's or B's left face with its own
 * arrowhead. With less than 3 columns of gap the old route under the row stays.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const SRC = 'flowchart LR\n  A --> B\n  A --> C\n  B --> C'

const render = (src: string, o: object = {}): string[] =>
  renderMermaidASCII(src, { colorMode: 'none', ...o }).split('\n')

describe('LR bypass edge keeps its own ports (#2043, #2044, #2739)', () => {
  it('draws the bypass beside B and into the left face of C (default padding)', () => {
    const rows = render(SRC).map((r) => r.trimEnd())
    expect(rows).toEqual([
      '          ┌───┐',
      '          │   │',
      '      ┌──►│ B ├──┐',
      '      │   │   │  │',
      '      │   └───┘  │',
      '      │          │',
      '      │          │',
      '      │          │',
      '      │          │',
      '┌───┐ │          │  ┌───┐',
      '│   ├─┘          └─►│   │',
      '│ A │               │ C │',
      '│   ├──────────────►│   │',
      '└───┘               └───┘',
    ])
  })

  it.each([3, 4, 5])('paddingX %i: three heads, none under a node', (px) => {
    const out = render(SRC, { paddingX: px }).join('\n')
    expect(out.match(/►/g)).toHaveLength(3) // A->B, B->C, A->C
    expect(out).not.toMatch(/▲/)
    const rows = out.split('\n')
    // A->C is a straight stroke along A's last row, into C's left face.
    expect(rows.some((r) => /^│   ├─+►│   │$/.test(r))).toBe(true)
  })

  it('draws the ASCII charset the same way', () => {
    const rows = render(SRC, { paddingX: 3, useAscii: true }).map((r) =>
      r.trimEnd(),
    )
    expect(rows).toEqual([
      '        +---+',
      '        |   |',
      '      +>| B +-+',
      '      | |   | |',
      '      | +---+ |',
      '      |       |',
      '      |       |',
      '      |       |',
      '      |       |',
      '+---+ |       | +---+',
      '|   +-+       +>|   |',
      '| A |           | C |',
      '|   +---------->|   |',
      '+---+           +---+',
    ])
  })

  it.each([1, 2])('paddingX %i keeps the old route under the row', (px) => {
    const rows = render(SRC, { paddingX: px }).map((r) => r.trimEnd())
    expect(rows[2]).not.toMatch(/[┬┴]/) // A's line out is one stroke
    expect(rows[4]).toMatch(/^└─┬─┘ +└───┘ +└───┘$/)
    expect(rows[5]).toMatch(/^ {2}│ +▲$/)
    expect(rows[6]).toMatch(/^ {2}└─+┘$/)
  })

  it('keeps an edge that shares a node with a self-loop on the old route', () => {
    const out = render(
      'flowchart LR\n  A --> B\n  A --> C\n  B --> C\n  C --> C',
    ).join('\n')
    expect(out).toContain('┬')
  })

  it('leaves a labeled triangle on the old route', () => {
    const out = render('flowchart LR\n  A --> B\n  A -->|x| C\n  B --> C')
    expect(out[0]).toMatch(/^┌───┐ +┌───┐ +┌───┐$/)
  })
})
