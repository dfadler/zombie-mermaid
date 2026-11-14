/**
 * #2043/#2044, then #2739: an LR edge that jumps a node on its row (`A --> C`
 * past `B`) used to share its first segment with `A --> B` and merge with
 * `B --> C` into one arrowhead. Mermaid 12.2.0 and 12.3.0 step `B` aside by 0.46 node heights (above, since
 * `A --> B` is declared first) and take `A --> C` to the other side of the row
 * and back (#3095: 17 px below, 12.3.0), each edge leaving A's right face and
 * entering C's or B's left face with its own arrowhead. With less than 3
 * columns of gap the old route under the row stays.
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
      '┌───┐ ┌──►│ B ├──┐  ┌───┐',
      '│   ├─┘   │   │  └─►│   │',
      '│ A │     └───┘     │ C │',
      '│   ├──┐         ┌─►│   │',
      '└───┘  └─────────┘  └───┘',
    ])
  })

  // Mermaid 12.2.0/12.3.0 (GitHub too): B sits 0.46 node heights off A and C
  // (22px of 48), so it overlaps their rows by 3 of 5, not by a border row.
  it('offsets B by 2 text rows when it sits below (mermaid 0.46 node heights)', () => {
    const below = render('flowchart LR\n  A --> C\n  A --> B\n  B --> C')
    expect(below.map((r) => r.trimEnd())).toEqual([
      '┌───┐  ┌─────────┐  ┌───┐',
      '│   ├──┘         └─►│   │',
      '│ A │     ┌───┐     │ C │',
      '│   ├─┐   │   │  ┌─►│   │',
      '└───┘ └──►│ B ├──┘  └───┘',
      '          │   │',
      '          └───┘',
    ])
  })

  it('takes the offset back from the gap above, leaving no extra blank rows', () => {
    const rows = render(
      'flowchart LR\n  Z --> Y\n  A --> B\n  A --> C\n  B --> C',
    ).map((r) => r.trimEnd())
    // Z's box ends on row 4, then the usual 4 blank rows, then B's top.
    expect(rows.slice(5, 9)).toEqual(['', '', '', ''])
    expect(rows[9]).toBe('          ┌───┐')
  })

  it('keeps the whole-slot offset when another block uses the rows', () => {
    // Y sits in the rows the tighter offset would hand to A's box.
    const rows = render(
      'flowchart LR\n  X --> A\n  A --> B\n  A --> C\n  B --> C\n  X --> Y\n  Y --> Z',
    )
    const top = (re: RegExp): number => rows.findIndex((r) => re.test(r))
    // B's box ends on the row A's box starts: they share only a border row.
    expect(top(/│ B ├/)).toBe(top(/│ A │/) - 4)
    expect(rows[top(/│ B ├/) + 2]).toContain('└───┘')
    expect(rows[top(/│ A │/) - 2]).toContain('┌───┐')
  })

  it.each([3, 4, 5])('paddingX %i: three heads, none under a node', (px) => {
    const out = render(SRC, { paddingX: px }).join('\n')
    expect(out.match(/►/g)).toHaveLength(3) // A->B, B->C, A->C
    expect(out).not.toMatch(/▲/)
    const rows = out.split('\n')
    // A->C leaves A's last row, dips onto the border row and rises into C.
    expect(rows.some((r) => /^│   ├─*┐ *┌─*►│   │$/.test(r))).toBe(true)
  })

  it('draws the ASCII charset the same way', () => {
    const rows = render(SRC, { paddingX: 3, useAscii: true }).map((r) =>
      r.trimEnd(),
    )
    expect(rows).toEqual([
      '        +---+',
      '        |   |',
      '+---+ +>| B +-+ +---+',
      '|   +-+ |   | +>|   |',
      '| A |   +---+   | C |',
      '|   +-+       +>|   |',
      '+---+ +-------+ +---+',
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
