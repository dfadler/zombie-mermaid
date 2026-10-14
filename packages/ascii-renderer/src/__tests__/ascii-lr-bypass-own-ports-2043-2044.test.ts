/**
 * #2043/#2044: an LR edge that jumps a node on its row (`A --> C` past `B`)
 * used to leave A's right face and enter C's left face, the cells the edges
 * through B use. It shared its first segment with `A --> B` and merged with
 * `B --> C` into one arrowhead. It now runs under the row: out of A's bottom
 * face, into C's bottom face.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const SRC = 'flowchart LR\n  A --> B\n  A --> C\n  B --> C'

const render = (src: string, o: object = {}): string[] =>
  renderMermaidASCII(src, { colorMode: 'none', ...o }).split('\n')

describe('LR bypass edge keeps its own ports (#2043, #2044)', () => {
  it.each([1, 2, 3, 5])("paddingX %i: out of A's bottom, into C's", (px) => {
    const rows = render(SRC, { paddingX: px }).map((r) => r.trimEnd())
    expect(rows[2]).not.toMatch(/[┬┴]/) // A's line out is one stroke
    expect(rows[4]).toMatch(/^└─┬─┘ +└───┘ +└───┘$/)
    expect(rows[5]).toMatch(/^ {2}│ +▲$/)
    expect(rows[6]).toMatch(/^ {2}└─+┘$/)
  })

  it('draws the second edge from its own exit and into its own arrowhead', () => {
    const rows = render(SRC, { paddingX: 2 }).map((r) => r.trimEnd())
    expect(rows).toEqual([
      '┌───┐   ┌───┐   ┌───┐',
      '│   │   │   │   │   │',
      '│ A ├──►│ B ├──►│ C │',
      '│   │   │   │   │   │',
      '└─┬─┘   └───┘   └───┘',
      '  │               ▲',
      '  └───────────────┘',
    ])
  })

  it('draws the ASCII charset the same way', () => {
    const rows = render(SRC, { paddingX: 2, useAscii: true }).map((r) =>
      r.trimEnd(),
    )
    expect(rows).toEqual([
      '+---+   +---+   +---+',
      '|   |   |   |   |   |',
      '| A +-->| B +-->| C |',
      '|   |   |   |   |   |',
      '+-+-+   +---+   +---+',
      '  |               ^',
      '  +---------------+',
    ])
  })

  it('never lets the two edges into C meet in one cell', () => {
    for (const paddingX of [1, 2, 3, 5]) {
      const out = render(SRC, { paddingX }).join('\n')
      // One arrowhead per edge: `►` into C's left face and `▲` into its bottom.
      expect(out.match(/►/g)).toHaveLength(2) // A->B, B->C
      expect(out.match(/▲/g)).toHaveLength(1) // A->C
      // No junction in a gap between nodes (the old shared stroke).
      expect(out).not.toMatch(/[┬┴]►/)
    }
  })

  it('works with a padding that leaves no room under the nodes', () => {
    const rows = render(SRC, { paddingX: 2, paddingY: 1 }).map((r) =>
      r.trimEnd(),
    )
    expect(rows[2]).toBe('│ A ├──►│ B ├──►│ C │')
    expect(rows[3]).toBe('│   │   │   │   │   │')
    expect(rows[5]).toBe('  │               ▲')
  })

  it('keeps an edge that shares a node with a self-loop on the old route', () => {
    const out = render(
      'flowchart LR\n  A --> B\n  A --> C\n  B --> C\n  C --> C',
    ).join('\n')
    expect(out).toContain('┬')
  })
})
